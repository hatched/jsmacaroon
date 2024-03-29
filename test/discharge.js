'use strict';

const test = require('tape');

const m = require('../js-macaroon');
const testUtils = require('./test-utils');

test('should discharge a macaroon with no caveats without calling getDischarge', t => {
  const macaroon = new m.Macaroon({
    rootKey: testUtils.strUint8Array('key'),
    identifier: 'some id',
    location: 'a location'
  });
  macaroon.addFirstPartyCaveat('a caveat');
  const getDischarge = () => {
    throw 'getDischarge called unexpectedly';
  };
  let result;
  const onOk = ms => {
    result = ms;
  };
  const onErr = err => {
    throw 'onErr called unexpectedly';
  };
  m.dischargeMacaroon(macaroon, getDischarge, onOk, onErr);
  t.deepEqual(result, [macaroon]);
  t.end();
});

test('should discharge many discharges correctly', t => {
  const rootKey = testUtils.strUint8Array('secret');
  const queued = [];
  const m0 = new m.Macaroon({
    rootKey,
    identifier: 'id0',
    location: 'location0'
  });
  let totalRequired = 40;
  let id = 1;
  const addCaveats = m => {
    let i;
    for (i = 0; i < 2; i++) {
      if (totalRequired === 0) {
        break;
      }
      const cid = 'id' + id;
      m.addThirdPartyCaveat(
        testUtils.strUint8Array('root key ' + cid), cid, 'somewhere');
      id++;
      totalRequired--;
    }
  };
  addCaveats(m0);
  const getDischarge = function (loc, thirdPartyLoc, cond, onOK, onErr) {
    t.equal(loc, 'location0');
    const macaroon = new m.Macaroon({
      rootKey: testUtils.strUint8Array('root key ' + cond),
      identifier: cond,
      location: ''});
    addCaveats(macaroon);
    queued.push(() => {
      onOK(macaroon);
    });
  };
  let discharges;
  m.dischargeMacaroon(m0, getDischarge, ms => {
    discharges = ms;
  }, err => {
    throw new Error('error callback called unexpectedly: ' + err);
  });
  while (queued.length > 0) {
    const f = queued.shift();
    f();
  }
  t.notEqual(discharges, null);
  t.equal(discharges.length, 41);
  discharges[0].verify(rootKey, ()=>{}, discharges.slice(1));
  t.end();
});
