# Aluni Chinese–Vietnamese dictionary preview

Data: [CVDICT by Phong Phan](https://github.com/ph0ngp/CVDICT), derived from
[CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict).
Data license: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Upstream snapshot: c379d909e308343a247e51619f7839a2060a271c (122,596 parsed records).
SHA-256 of CVDICT.u8: 4dde4b204193efa9c192d7f7daeab1bb579c8ccd7c41ed90d1b6caee22ba0948.

The downloadable upstream data is fetched unchanged from pinned raw GitHub, with
pinned jsDelivr as a second source, only when search is used. About 10.8 MB is
needed initially. IndexedDB retains a copy when storage permits. SHA-256 is checked
before use (including cached data). A Web Worker parses/searches without blocking
the UI. Reloading still requires parsing, but not downloading when cached.
No API key, paid translation service, course database changes or account changes.
This is a client-side dictionary, not a deployed server dictionary.

Vietnamese definitions in this community dataset were largely translated with AI
and partly manually reviewed upstream; they are not all teacher-verified. Keep
this attribution visible and preserve the upstream license for redistributed or
adapted data. Search transforms spelling and ranks common terms; it does not
rewrite the source file. Different senses and pinyin homophones can be returned.

Limits: first use requires access to a source host. Browser eviction/private mode
may prevent persistence. Results capped at 60; no claim of exhaustive coverage.
Examples continue to use the separate authored Aluni example catalog; this source
does not provide validated example sentences for every word. No automatic merge.

Reproduce data tests:
Download the pinned CVDICT.u8 from the source repository, then run
`CVDICT_PATH=/absolute/path/CVDICT.u8 node tests/dictionary.test.cjs`.
The normal npm test suite uses a small fixture; the optional full-file test checks
count, checksum, real multi-topic results, Hanzi/traditional and pinyin.

## Compact lookup behavior

The uploaded V94 and Alunihanzi production backups use a single translated card for Vietnamese words outside the course pool. The search wrapper now prioritizes that production translator over Vietnamese dictionary hits. Exact local matches return immediately. Exact Hanzi/pinyin matches use the dictionary without Vietnamese translation. If translation fails, the dictionary supplies a compact fallback (one Vietnamese headword, up to three Hanzi/pinyin entries). Accented Vietnamese retains its marks so mèo does not match mẹo. Known classifier prefixes are handled without broad substring matching. No worker or SQL backup is imported into production.
