import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeCsv, parseStandingsCsv, exportStandingsCsv } from '../src/core/csv-parser.js';

describe('tokenizeCsv', () => {
  test('basic LF / CRLF / CR', () => {
    const expected = [['a', 'b'], ['c', 'd']];
    assert.deepEqual(tokenizeCsv('a,b\nc,d'), expected);
    assert.deepEqual(tokenizeCsv('a,b\r\nc,d'), expected);
    assert.deepEqual(tokenizeCsv('a,b\rc,d'), expected);
    assert.deepEqual(tokenizeCsv('a,b\nc,d\n'), expected);
    assert.deepEqual(tokenizeCsv('a,b\r\nc,d\r\n'), expected);
  });
  test('empty / non-string', () => {
    assert.deepEqual(tokenizeCsv(''), []);
    for (const v of [null, undefined, 5, {}, []]) assert.deepEqual(tokenizeCsv(v), []);
  });
  test('empty cells', () => {
    assert.deepEqual(tokenizeCsv('a,,c'), [['a', '', 'c']]);
    assert.deepEqual(tokenizeCsv('a,'), [['a', '']]);
    assert.deepEqual(tokenizeCsv(','), [['', '']]);
    assert.deepEqual(tokenizeCsv(',,,,,'), [['', '', '', '', '', '']]);
    assert.deepEqual(tokenizeCsv('\n'), [['']]);
  });
  test('quoted commas', () => {
    assert.deepEqual(tokenizeCsv('"a,b",c'), [['a,b', 'c']]);
  });
  test('escaped quotes', () => {
    assert.deepEqual(tokenizeCsv('"he said ""hi""",x'), [['he said "hi"', 'x']]);
    assert.deepEqual(tokenizeCsv('""""'), [['"']]);
    assert.deepEqual(tokenizeCsv('""'), [['']]);
  });
  test('multiline quoted cells', () => {
    assert.deepEqual(tokenizeCsv('a,"line1\nline2"\nb,c'), [['a', 'line1\nline2'], ['b', 'c']]);
    assert.deepEqual(tokenizeCsv('"l1\r\nl2",z'), [['l1\r\nl2', 'z']]);
  });
  test('UTF-8 BOM stripped', () => {
    assert.deepEqual(tokenizeCsv('\uFEFFa,b'), [['a', 'b']]);
    assert.deepEqual(tokenizeCsv('\uFEFF"a",b'), [['a', 'b']]);
  });
  test('stray quote in unquoted field is literal', () => {
    assert.deepEqual(tokenizeCsv('a"b,c'), [['a"b', 'c']]);
  });
  test('unterminated quote does not throw', () => {
    assert.deepEqual(tokenizeCsv('a,"b,c\nd'), [['a', 'b,c\nd']]);
    assert.deepEqual(tokenizeCsv('"'), [['']]);
  });
  test('unicode preserved', () => {
    assert.deepEqual(tokenizeCsv('Flabébé,😀'), [['Flabébé', '😀']]);
  });
});

const DATA_CSV = [
  'location,date,challenge,cup,regulation,player count',
  'Wyndon Stadium,July 8th,,x,M-8,8',
  ',,,,,',
  'placing,name,handle,local,paste,',
  '1,Ash Ketchum,@pikafan25,Wyndon-Cup-7-8-2022,https://pokepast.es/33bbc4f4633968dc,',
  '2,Misty,misty_water,,https://pokepast.es/abcd1234,',
  '',
].join('\n');

describe('parseStandingsCsv', () => {
  test('actual data.csv format', () => {
    const { tournament: t, warnings } = parseStandingsCsv(DATA_CSV);
    assert.deepEqual(warnings, []);
    assert.equal(t.event.eventType, 'cup');
    assert.equal(t.event.location, 'Wyndon Stadium');
    assert.equal(t.event.date, 'July 8th');
    assert.equal(t.event.regulation, 'M-8');
    assert.equal(t.event.playerCount, 8);
    assert.equal(t.standings.length, 2);
    const [a, b] = t.standings;
    assert.equal(a.placing, '1');
    assert.equal(a.name, 'Ash Ketchum');
    assert.equal(a.handle, '@pikafan25');
    assert.equal(a.local, 'Wyndon-Cup-7-8-2022');
    assert.equal(a.teamSource, 'https://pokepast.es/33bbc4f4633968dc');
    assert.deepEqual(a.warnings, []);
    assert.equal(b.handle, '@misty_water');
    assert.equal(t.schemaVersion, 1);
  });
  test('CRLF + BOM variant parses identically', () => {
    const a = parseStandingsCsv(DATA_CSV).tournament;
    const b = parseStandingsCsv('\uFEFF' + DATA_CSV.replace(/\n/g, '\r\n')).tournament;
    assert.deepEqual(b.event, a.event);
    assert.deepEqual(b.standings.map(({ id, ...r }) => r), a.standings.map(({ id, ...r }) => r));
  });
  test('challenge event', () => {
    const csv = DATA_CSV.replace('Wyndon Stadium,July 8th,,x,', 'Wyndon Stadium,July 8th,x,,');
    assert.equal(parseStandingsCsv(csv).tournament.event.eventType, 'challenge');
  });
  test('both or neither -> local', () => {
    const both = DATA_CSV.replace('July 8th,,x,', 'July 8th,x,x,');
    const neither = DATA_CSV.replace('July 8th,,x,', 'July 8th,,,');
    assert.equal(parseStandingsCsv(both).tournament.event.eventType, 'local');
    assert.equal(parseStandingsCsv(neither).tournament.event.eventType, 'local');
  });
  test("'false' / '0' / 'no' in challenge/cup are falsy", () => {
    for (const falsy of ['false', 'FALSE', '0', 'no', 'No', 'n', 'off']) {
      const csv = DATA_CSV.replace('July 8th,,x,', `July 8th,${falsy},${falsy},`);
      assert.equal(parseStandingsCsv(csv).tournament.event.eventType, 'local', falsy);
      const cupOnly = DATA_CSV.replace('July 8th,,x,', `July 8th,${falsy},yes,`);
      assert.equal(parseStandingsCsv(cupOnly).tournament.event.eventType, 'cup', falsy);
    }
  });
  test('duplicate placings preserved as separate entries', () => {
    const csv = DATA_CSV + '2,Brock,brock,,https://pokepast.es/zzz,\n';
    const { tournament } = parseStandingsCsv(csv);
    assert.ok(Array.isArray(tournament.standings));
    assert.equal(tournament.standings.length, 3);
    assert.deepEqual(tournament.standings.map((s) => s.placing), ['1', '2', '2']);
    assert.equal(new Set(tournament.standings.map((s) => s.id)).size, 3);
  });
  test('missing event metadata row', () => {
    const csv = 'placing,name,handle,local,paste,\n1,Ash,ash,,https://pokepast.es/abc,\n2,Bob,bob,,https://pokepast.es/def,';
    const { tournament, warnings } = parseStandingsCsv(csv);
    assert.ok(warnings.some((w) => /Event info row missing/.test(w)));
    assert.equal(tournament.standings.length, 2);
    assert.equal(tournament.event.playerCount, 2);
    assert.equal(tournament.event.eventType, 'local');
  });
  test('metadata header but no values row', () => {
    const csv = 'location,date,challenge,cup,regulation,player count\nplacing,name,handle,local,paste,\n1,Ash,ash,,https://pokepast.es/abc,';
    const { tournament, warnings } = parseStandingsCsv(csv);
    assert.ok(warnings.some((w) => /Event info row missing/.test(w)));
    assert.equal(tournament.standings.length, 1);
  });
  test('missing blank separator row', () => {
    const csv = DATA_CSV.replace(',,,,,\n', '');
    const { tournament, warnings } = parseStandingsCsv(csv);
    assert.deepEqual(warnings, []);
    assert.equal(tournament.standings.length, 2);
    assert.equal(tournament.event.location, 'Wyndon Stadium');
  });
  test('missing standings header assumes default columns', () => {
    const csv = 'location,date,challenge,cup,regulation,player count\nX,Y,,x,M-A,4\n,,,,,\n1,Ash,ash,,https://pokepast.es/abc,';
    const { tournament, warnings } = parseStandingsCsv(csv);
    assert.ok(warnings.some((w) => /header row/.test(w)));
    assert.equal(tournament.standings.length, 1);
    assert.equal(tournament.standings[0].name, 'Ash');
  });
  test('truncated rows', () => {
    const csv = DATA_CSV + '3,Gary\n4\n';
    const { tournament, warnings } = parseStandingsCsv(csv);
    assert.ok(warnings.some((w) => /Row 7 is short/.test(w)));
    const gary = tournament.standings.find((s) => s.name === 'Gary');
    assert.ok(gary);
    assert.equal(gary.teamSource, '');
    assert.deepEqual(gary.warnings, ['No team provided.']);
    assert.equal(tournament.standings.length, 4);
  });
  test('row with neither placing nor name skipped', () => {
    const csv = DATA_CSV + ',,handle,local,paste,\n';
    const { tournament, warnings } = parseStandingsCsv(csv);
    assert.equal(tournament.standings.length, 2);
    assert.ok(warnings.some((w) => /skipped/.test(w)));
  });
  test('inline Showdown paste in paste column', () => {
    const paste = 'Pikachu @ Light Ball\nAbility: Static\n- Thunderbolt\n\nIncineroar @ Sitrus Berry\nAbility: Intimidate';
    const csv = DATA_CSV + `3,Gary,gary,,"${paste}",\n`;
    const { tournament } = parseStandingsCsv(csv);
    const gary = tournament.standings[2];
    assert.equal(gary.pokemon.length, 2);
    assert.equal(gary.pokemon[0].name, 'Pikachu');
    assert.equal(gary.pokemon[1].name, 'Incineroar');
  });
  test('malformed URLs produce an entry warning', () => {
    const csv = DATA_CSV + '3,Gary,gary,,https://evil.com/x,\n4,Dawn,dawn,,javascript:alert(1),\n';
    const { tournament } = parseStandingsCsv(csv);
    for (const e of tournament.standings.slice(2)) {
      assert.ok(e.warnings.some((w) => /not a valid pokepast\.es URL/.test(w)));
      assert.equal(pokemonCount(e), 0);
    }
  });
  test('pokepast.es URL without scheme is normalized', () => {
    const csv = DATA_CSV + '3,Gary,gary,,pokepast.es/xyz/raw,\n';
    assert.equal(parseStandingsCsv(csv).tournament.standings[2].teamSource, 'https://pokepast.es/xyz');
  });
  test('missing paste yields No team provided', () => {
    const csv = DATA_CSV + '3,Gary,gary,,,\n';
    assert.deepEqual(parseStandingsCsv(csv).tournament.standings[2].warnings, ['No team provided.']);
  });
  test('player count falls back to standings length', () => {
    const csv = DATA_CSV.replace(',M-8,8', ',M-8,');
    assert.equal(parseStandingsCsv(csv).tournament.event.playerCount, 2);
  });
  test('header aliases and reordered columns', () => {
    const csv = 'location,date,challenge,cup,reg,players\nX,Y,x,,M-A,12\n,,,,,\nplacing,player,paste,handle,local\n1,Ash,https://pokepast.es/abc,ash,loc\n';
    const { tournament } = parseStandingsCsv(csv);
    const e = tournament.standings[0];
    assert.equal(e.placing, '1');
    assert.equal(e.name, 'Ash');
    assert.equal(e.teamSource, 'https://pokepast.es/abc');
    assert.equal(e.handle, '@ash');
    assert.equal(e.local, 'loc');
    assert.equal(tournament.event.regulation, 'M-A');
    assert.equal(tournament.event.playerCount, 12);
    assert.equal(tournament.event.eventType, 'challenge');
  });
  test('no standings rows', () => {
    const csv = 'location,date,challenge,cup,regulation,player count\nX,Y,,x,M-A,4\n,,,,,\nplacing,name,handle,local,paste,\n';
    const { tournament, warnings } = parseStandingsCsv(csv);
    assert.equal(tournament.standings.length, 0);
    assert.ok(warnings.includes('No standings rows found.'));
  });
  test('empty / non-string', () => {
    let r = parseStandingsCsv('');
    assert.deepEqual(r.warnings, ['CSV is empty.']);
    assert.equal(r.tournament.standings.length, 0);
    r = parseStandingsCsv('\n\n,,,\n');
    assert.deepEqual(r.warnings, ['CSV is empty.']);
    for (const v of [null, undefined, 5, {}]) {
      r = parseStandingsCsv(v);
      assert.deepEqual(r.warnings, ['CSV input is not a string.']);
      assert.equal(r.tournament.standings.length, 0);
    }
  });
  test('hostile content is sanitized', () => {
    const csv = DATA_CSV + '3,"Ev\u202Eil\x00",<b>x</b>,,,\n';
    const e = parseStandingsCsv(csv).tournament.standings[2];
    assert.equal(e.name, 'Evil');
    assert.equal(e.handle, '@bxb');
  });
});

function pokemonCount(entry) {
  return entry.pokemon.length;
}

describe('exportStandingsCsv', () => {
  test('format', () => {
    const { tournament } = parseStandingsCsv(DATA_CSV);
    const out = exportStandingsCsv(tournament);
    const lines = out.split('\r\n');
    assert.equal(lines[0], 'location,date,challenge,cup,regulation,player count');
    assert.equal(lines[1], 'Wyndon Stadium,July 8th,,x,M-8,8');
    assert.equal(lines[2], ',,,,,');
    assert.equal(lines[3], 'placing,name,handle,local,paste,');
    assert.equal(lines[4], '1,Ash Ketchum,@pikafan25,Wyndon-Cup-7-8-2022,https://pokepast.es/33bbc4f4633968dc,');
    assert.ok(out.endsWith('\r\n'));
  });
  test('round trip preserves event and standings', () => {
    const first = parseStandingsCsv(DATA_CSV).tournament;
    const second = parseStandingsCsv(exportStandingsCsv(first)).tournament;
    assert.deepEqual(second.event, first.event);
    const strip = (t) => t.standings.map(({ id, ...r }) => r);
    assert.deepEqual(strip(second), strip(first));
  });
  test('round trip with commas, quotes, newlines, challenge', () => {
    const paste = 'Pikachu @ Light Ball\nAbility: "Static"\n- Thunderbolt';
    const csv = [
      'location,date,challenge,cup,regulation,player count',
      '"Portland, OR",Jan 1,x,,M-A,3',
      ',,,,,',
      'placing,name,handle,local,paste,',
      `1,"Smith, ""Ace"" John",ace,"loc, a",https://pokepast.es/abc,`,
      `2,Bob,bob,,"${paste.replace(/"/g, '""')}",`,
    ].join('\n');
    const first = parseStandingsCsv(csv).tournament;
    assert.equal(first.event.location, 'Portland, OR');
    assert.equal(first.event.eventType, 'challenge');
    assert.equal(first.standings[0].name, 'Smith, "Ace" John');
    const second = parseStandingsCsv(exportStandingsCsv(first)).tournament;
    assert.deepEqual(second.event, first.event);
    const strip = (t) => t.standings.map(({ id, pokemon, warnings, ...r }) => r);
    assert.deepEqual(strip(second), strip(first));
    assert.equal(second.standings[1].pokemon.length, 1);
  });
  test('duplicate placings round trip', () => {
    const csv = DATA_CSV + '2,Brock,brock,,https://pokepast.es/zzz,\n';
    const first = parseStandingsCsv(csv).tournament;
    const second = parseStandingsCsv(exportStandingsCsv(first)).tournament;
    assert.deepEqual(second.standings.map((s) => s.placing), ['1', '2', '2']);
  });
  test('handles junk input without throwing', () => {
    for (const v of [null, undefined, 5, {}, { event: null, standings: [null, 5] }]) {
      const out = exportStandingsCsv(v);
      assert.ok(out.startsWith('location,date,challenge,cup,regulation,player count\r\n'));
    }
  });
  test('local event / zero player count export blanks', () => {
    const out = exportStandingsCsv({ event: { eventType: 'local', location: 'L', playerCount: 0 }, standings: [] });
    assert.equal(out.split('\r\n')[1], 'L,,,,,');
  });
});
