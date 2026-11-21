const bitcoinNetworks = [''];
const miningTimeIntervals = '<code>24h</code>, <code>3d</code>, <code>1w</code>, <code>1m</code>, <code>3m</code>, <code>6m</code>, <code>1y</code>, <code>2y</code>, <code>3y</code>';

const emptyCodeSample = {
  esModule: [],
  commonJS: [],
  curl: [],
  response: ``
};

const showJsExamplesDefault = { '': true };
const showJsExamplesDefaultFalse = { '': false };

export const wsApiDocsData = [
  {
    type: 'category',
    category: 'general',
    fragment: 'general',
    title: 'General',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'general',
    fragment: 'live-data',
    title: 'Live Data',
    description: {
      default: 'Subscribe to live data. Available: <code>blocks</code>, <code>mempool-block</code>, <code>live-2h-chart</code>, and <code>stats</code>.'
    },
    payload: '{ "action": "want", "data": ["mempool-blocks", "stats"] }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-blocks": [
    {
      "blockSize": 1801614,
      "blockVSize": 997936.5,
      "nTx": 3391,
      "totalFees": "8170664",
      "medianFee": 6.011217160720601,
      "feeRange": [
        4.584615384615384,
        5,
        5.100456621004566,
        6.002319288751449,
        7.235398230088496,
        10.377668308702791,
        200
      ]
    },
    ...
    {
      "blockSize": 198543075,
      "blockVSize": 101691348,
      "nTx": 249402,
      "totalFees": "135312667",
      "medianFee": 1.2559438783834156,
      "feeRange": [
        1.000685629033809,
        1.0020213063577312,
        1.0019080827758888,
        1.0227913345013278,
        1.1188648002395873,
        1.2559438783834156,
        1.4077952614964329,
        1.4079805737077244,
        1.5106880342499638,
        2.003440424869914,
        2.2713888268854894
      ]
    }
  ],
  "mempoolInfo": {
    "loaded": true,
    "size": 264505,
    "bytes": 108875402,
    "usage": 649908688,
    "total_fee": 1.61036575,
    "maxmempool": 300000000,
    "mempoolminfee": 0.00001858,
    "minrelaytxfee": 0.00001,
    "incrementalrelayfee": 0.00001,
    "unbroadcastcount": 0,
    "fullrbf": true
  },
  "vBytesPerSecond": 1651,
  "fees": {
    "fastestFee": 7,
    "halfHourFee": 6,
    "hourFee": 5,
    "economyFee": 4,
    "minimumFee": 2
  },
  "da": {
    "progressPercent": 32.49007936507937,
    "difficultyChange": 0.7843046881601534,
    "estimatedRetargetDate": 1735514828279,
    "remainingBlocks": 1361,
    "remainingTime": 811481279,
    "previousRetarget": 4.429396745461176,
    "previousTime": 1734312810,
    "nextRetargetHeight": 600000,
    "timeAvg": 596239,
    "adjustedTimeAvg": 596239,
    "timeOffset": 0,
    "expectedBlocks": 650.895
  }
}`
        },
      }
    }
  },
  {
    type: 'category',
    category: 'addresses',
    fragment: 'addresses',
    title: 'Addresses',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'addresses',
    fragment: 'track-address',
    title: 'Track Address',
    description: {
      default: 'Subscribe to a single address to receive live updates on new transactions having that address in input or output. <code>address-transactions</code> field contains new mempool transactions, and <code>block-transactions</code> contains new confirmed transactions.'
    },
    payload: '{ "track-address": "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr" }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "block-transactions": [
    {
      "txid": "06b9f35b85ec5e4816cd0fc4c5e73aee45822b024238a718f3c50c61234804f2",
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "txid": "4f01de4d28ec6fe6195abfa90cc2a34b8c062b7ffca7fcd828613c1ca531f9eb",
          "vout": 0,
          "prevout": {
            "scriptpubkey": "a914c9848245ae4f5d5934b5cbdfb79e04cdd337470b87",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 c9848245ae4f5d5934b5cbdfb79e04cdd337470b OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45",
            "value": "24962957"
          },
          "scriptsig": "0048304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f0147304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e014c695221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_72 304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f01 OP_PUSHBYTES_71 304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e01 OP_PUSHDATA1 5221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c0 OP_PUSHBYTES_33 03556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb695 OP_PUSHBYTES_33 031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb OP_PUSHNUM_3 OP_CHECKMULTISIG"
        },
        ...
        {
          "txid": "7915699e8be42c9ad1ab50424cf3063072d3c5ed42edc77e7a01d9051fa18e89",
          "vout": 1,
          "prevout": {
            "scriptpubkey": "a914a3aff5f5765f167c1582fd85517ddde83174118187",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 a3aff5f5765f167c1582fd85517ddde831741181 OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
            "value": "1719827"
          },
          "scriptsig": "0047304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201483045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff144014c69522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_71 304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201 OP_PUSHBYTES_72 3045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff14401 OP_PUSHDATA1 522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 03650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b28 OP_PUSHBYTES_33 02510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a OP_PUSHBYTES_33 02985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f8 OP_PUSHNUM_3 OP_CHECKMULTISIG"
        }
      ],
      "vout": [
        {
          "scriptpubkey": "0014292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_type": "v0_p2wpkh",
          "scriptpubkey_address": "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
          "value": "57000"
        },
        ...
        {
          "scriptpubkey": "0020e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_type": "v0_p2wsh",
          "scriptpubkey_address": "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
          "value": "17343523"
        }
      ],
      "size": 5514,
      "weight": 22056,
      "sigops": 208,
      "fee": "44000",
      "status": {
        "confirmed": true,
        "block_height": 500000,
        "block_hash": "00000000000002cde633f5f4f5e77fe4e42cda8f7e803b661f53119a2a0ac66b",
        "block_time": 1734704791
      },
      "order": 864069877,
      "vsize": 5514,
      "adjustedVsize": 5514,
      "feePerVsize": 7.979688066739209,
      "adjustedFeePerVsize": 7.979688066739209,
      "effectiveFeePerVsize": 7.979688066739209,
      "firstSeen": 1734704590,
      "inputs": [],
      "cpfpDirty": false,
      "ancestors": [],
      "descendants": [],
      "bestDescendant": null,
      "position": {
        "block": 0,
        "vsize": 191567
      },
      "flags": 1099511659526
    }
  ]
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    fragment: 'track-addresses',
    title: 'Track Addresses',
    description: {
      default: 'Subscribe to multiple addresses to receive live updates on new transactions having these addresses in input or output. Limits on the maximum number of tracked addresses apply. For higher tracking limits, consider upgrading to an contacting support.'
    },
    payload: `{
  "track-addresses": [
    "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
    "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr"
  ]
}`,
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "multi-address-transactions": {
    "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr": {
      "mempool": [],
      "confirmed": [
        {
          "txid": "90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131",
          "version": 2,
          "locktime": 500001,
          "vin": [
            {
              "txid": "4f01de4d28ec6fe6195abfa90cc2a34b8c062b7ffca7fcd828613c1ca531f9eb",
              "vout": 1,
              "prevout": {
                "scriptpubkey": "0014257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
                "value": "1831200"
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "witness": [
                "3044022028363f66fe74bdddf46d204cbf9844d4ef99d6fcb801f93f3ea1666ff51514340220058eb99790dd002323bd12afa0b62903cf72465d48c40cb11366dfa4eebbd87a01",
                "020e625e13a81995f29ee828e31500b8454bd0b115f84dfa07d994eecd733efffa"
              ],
              "is_coinbase": false,
              "sequence": 4294967294
            },
            ...
          ],
          "vout": [
            {
              "scriptpubkey": "0020949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_type": "v0_p2wsh",
              "scriptpubkey_address": "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
              "value": "2546637"
            }
          ],
          "size": 351,
          "weight": 756,
          "sigops": 2,
          "fee": "4206",
          "status": {
            "confirmed": true,
            "block_height": 500002,
            "block_hash": "00000000000000322b892cc337a5c572b1d637aebc2c039784a3ee317651c10c",
            "block_time": 1734720142
          },
          "order": 81067521,
          "vsize": 189,
          "adjustedVsize": 189,
          "feePerVsize": 22.253968253968253,
          "adjustedFeePerVsize": 22.253968253968253,
          "effectiveFeePerVsize": 22.253968253968253,
          "firstSeen": 1734719830,
          "inputs": [],
          "cpfpDirty": false,
          "ancestors": [],
          "descendants": [],
          "bestDescendant": null,
          "position": {
            "block": 0,
            "vsize": 134866.5
          },
          "flags": 1099511640074
        }
      ],
      "removed": []
    }
  }
}`
        },
      }
    }
  },
  {
    type: 'category',
    category: 'transactions',
    fragment: 'transactions',
    title: 'Transactions',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'track-tx',
    title: 'Track Transaction',
    description: {
      default: 'Subscribe to a transaction to receive live updates on its confirmation status and position in the mempool.'
    },
    payload: '{ "track-tx": "b7589c919eb4c5284ec5724b42487bde6da4dc12d600e301da43f9b65cd76047" }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "txPosition": {
    "txid": [
      "b7589c919eb4c5284ec5724b42487bde6da4dc12d600e301da43f9b65cd76047"
    ],
    "position": {
      "block": 0,
      "vsize": 726868
    },
    "cpfp": {
      "ancestors": [
        {
          "txid": "90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131",
          "fee": "605",
          "weight": 520
        }
      ],
      "bestDescendant": null,
      "descendants": [
        {
          "txid": "b7589c919eb4c5284ec5724b42487bde6da4dc12d600e301da43f9b65cd76047",
          "fee": "2501",
          "weight": 816
        }
      ],
      "effectiveFeePerVsize": 5.12063778580024,
      "sigops": 0,
      "adjustedVsize": 130
    }
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'track-txs',
    title: 'Track Transactions',
    description: {
      default: 'Subscribe to multiple transactions to receive live updates on their status and position in the mempool. Limits on the maximum number of tracked addresses apply. For higher tracking limits, consider upgrading to an contacting support.'
    },
    payload: `{
      "track-txs": [
        "b7589c919eb4c5284ec5724b42487bde6da4dc12d600e301da43f9b65cd76047",
        "0367284f1192d6e5e33ffe70652e22cb39c7a18d20045823d18a7530de0e1fd4"
      ]
    }`,
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "tracked-txs": {
    "b7589c919eb4c5284ec5724b42487bde6da4dc12d600e301da43f9b65cd76047": {
      "position": {
        "block": 0,
        "vsize": 434494
      },
      "cpfp": {
        "ancestors": [
          {
            "txid": "90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131",
            "fee": "605",
            "weight": 520
          }
        ],
        "bestDescendant": null,
        "descendants": [
          {
          "txid": "b7589c919eb4c5284ec5724b42487bde6da4dc12d600e301da43f9b65cd76047",
          "fee": "2501",
          "weight": 816
          }
        ],
        "effectiveFeePerVsize": 5.12063778580024,
        "sigops": 0,
        "adjustedVsize": 130
      }
    },
    "0367284f1192d6e5e33ffe70652e22cb39c7a18d20045823d18a7530de0e1fd4": {
      "position": {
        "block": 2,
        "vsize": 932479.5
      }
    }
  }
}`
        },
      }
    }
  },
  {
    type: 'category',
    category: 'mempool',
    fragment: 'mempool',
    title: 'Mempool',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-mempool',
    title: 'Track Mempool',
    description: {
      default: 'Subscribe to new mempool events, such as new transactions entering the mempool. Available fields: <code>added</code>, <code>removed</code>, <code>mined</code>, <code>replaced</code>. <br> Because this is potentially a lot of data, consider using the <code>track-mempool-txids</code> endpoint described below instead, or upgrade to an contacting support.'
    },
    payload: '{ "track-mempool": true }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-transactions": {
    "sequence": 81419,
    "added": [
      {
        "txid": "a5fbc1f831a271f6150811cf79f7d7760f59e0176a9fcc99c3b714c2da30ec71",
        "version": 2,
        "locktime": 0,
        "vin": [
          {
            "txid": "b7589c919eb4c5284ec5724b42487bde6da4dc12d600e301da43f9b65cd76047",
            "vout": 5,
            "prevout": {
              "scriptpubkey": "76a914b54afb58f0faa9d1bde2ed755bc56ef1e4a4e24188ac",
              "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 b54afb58f0faa9d1bde2ed755bc56ef1e4a4e241 OP_EQUALVERIFY OP_CHECKSIG",
              "scriptpubkey_type": "p2pkh",
              "scriptpubkey_address": "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
              "value": "17000"
            },
            "scriptsig": "4830450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a83649404012103cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "scriptsig_asm": "OP_PUSHBYTES_72 30450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a8364940401 OP_PUSHBYTES_33 03cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "is_coinbase": false,
            "sequence": 4294967293
          }
        ],
        "vout": [
          {
            "scriptpubkey": "76a91401603bd82a5d5a6e8c6df5d9ae662b9fc5db60f288ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 01603bd82a5d5a6e8c6df5d9ae662b9fc5db60f2 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45",
            "value": "10419"
          },
          {
            "scriptpubkey": "76a914338ad842d236486627834bf9f5e182c7a8aa937188ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 338ad842d236486627834bf9f5e182c7a8aa9371 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
            "value": "5396"
          }
        ],
        "size": 226,
        "weight": 904,
        "sigops": 8,
        "fee": "1185",
        "status": {
          "confirmed": false
        },
        "order": 701659019,
        "vsize": 226,
        "adjustedVsize": 226,
        "feePerVsize": 5.243362831858407,
        "adjustedFeePerVsize": 5.243362831858407,
        "effectiveFeePerVsize": 5.243362831858407,
        "firstSeen": 1734893382,
        "uid": 429139,
        "inputs": [],
        "cpfpDirty": false,
        "ancestors": [],
        "descendants": [],
        "bestDescendant": null,
        "position": {
          "block": 0,
          "vsize": 125270
        },
        "flags": 1099511628809
      },
      ...
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-mempool-txids',
    title: 'Track Mempool Txids',
    description: {
      default: 'Low-bandwith substitute to the above command <code>track-mempool</code>: subscribe to new mempool events, such as new transactions entering the mempool, but only transaction IDs are returned to save bandwith. Available fields: <code>added</code>, <code>removed</code>, <code>mined</code>, <code>replaced</code>.'
    },
    payload: '{ "track-mempool-txids": true }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-txids": {
    "sequence": 79919,
    "added": [
      "b7589c919eb4c5284ec5724b42487bde6da4dc12d600e301da43f9b65cd76047",
      "7915699e8be42c9ad1ab50424cf3063072d3c5ed42edc77e7a01d9051fa18e89",
      "90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131",
      "06b9f35b85ec5e4816cd0fc4c5e73aee45822b024238a718f3c50c61234804f2",
      "b7589c919eb4c5284ec5724b42487bde6da4dc12d600e301da43f9b65cd76047",
      "0367284f1192d6e5e33ffe70652e22cb39c7a18d20045823d18a7530de0e1fd4",
      "90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131"
    ],
    "removed": [],
    "mined": [],
    "replaced": []
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-mempool-block',
    title: 'Track Mempool Block',
    description: {
      default: 'Subscribe to live mempool projected block template, index 0 being the first mempool block. <br> A full set of stripped transactions in that block is returned when the subscription starts, and deltas (removed and added transactions) are then sent every time the mempool changes.'
    },
    payload: '{ "track-mempool-block": 0 }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "projected-block-transactions": {
    "index": 0,
    "sequence": 80270,
    "delta": {
      "added": [
        [
          "94167cdbac9b75744eb2768d4318d09404dbf1cabd696c4823f5760d67c28399",
          2000,
          171.25,
          5942725,
          11.68,
          1099511631877,
          1734881537
        ],
        ...
      ],
      "removed": [
        "94167cdbac9b75744eb2768d4318d09404dbf1cabd696c4823f5760d67c28399",
        ...
        ],
      "changed": []
    }
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-rbf',
    title: 'Track Mempool RBF Transactions',
    description: {
      default: 'Subscribe to new RBF events.'
    },
    payload: '{ "track-rbf": "all" }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "rbfLatest": [
    {
      "tx": {
        "txid": "94167cdbac9b75744eb2768d4318d09404dbf1cabd696c4823f5760d67c28399",
        "fee": "8280",
        "vsize": 204,
        "value": "156397",
        "rate": 10,
        "time": 1734876576,
        "rbf": true,
        "fullRbf": false
      },
      "time": 1734876576,
      "fullRbf": false,
      "replaces": [
        {
          "tx": {
            "txid": "d76483d1dcf6b316aaa69123dab933331d0ed1d4a1836849b610aa5818611938",
            "fee": "4956",
            "vsize": 204,
            "value": "159721",
            "rate": 9,
            "time": 1734876204,
            "rbf": true,
            "fullRbf": false
          },
          "time": 1734876204,
          "fullRbf": false,
          "replaces": [
            {
              "tx": {
                "txid": "4f01de4d28ec6fe6195abfa90cc2a34b8c062b7ffca7fcd828613c1ca531f9eb",
                "fee": "1632",
                "vsize": 204,
                "value": "163045",
                "rate": 8,
                "time": 1734876081,
                "rbf": true
              },
              "time": 1734876081,
              "interval": 123,
              "fullRbf": false,
              "replaces": []
            }
          ],
          "interval": 372
        }
      ]
    },
    ...
  ]
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-full-rbf',
    title: 'Track Mempool Full RBF Transactions',
    description: {
      default: 'Subscribe to new Full RBF events.'
    },
    payload: '{ "track-rbf": "fullRbf" }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "rbfLatest": [
    {
      "tx": {
        "txid": "98b4f3c7eb5b92092ac0ef8a6da58a9c304a24e37529b488d85aa4db3f9b0bca",
        "fee": "4123",
        "vsize": 587.75,
        "value": "25545",
        "rate": 7.014887282007656,
        "time": 1734876941,
        "rbf": false,
        "fullRbf": true
      },
      "time": 1734876941,
      "fullRbf": true,
      "replaces": [
        {
          "tx": {
            "txid": "9e9635d8f165ef8c0c5754ac971268ee96e934f921bf39ca898c85e4b366ac20",
            "fee": "1178",
            "vsize": 587.25,
            "value": "28490",
            "rate": 2.0059599829714774,
            "time": 1734853572,
            "rbf": false,
            "fullRbf": true
          },
          "time": 1734853572,
          "fullRbf": true,
          "replaces": [
            {
              "tx": {
                "txid": "4f01de4d28ec6fe6195abfa90cc2a34b8c062b7ffca7fcd828613c1ca531f9eb",
                "fee": "589",
                "vsize": 587.25,
                "value": "29079",
                "rate": 1.0029799914857387,
                "time": 1734781955,
                "rbf": false
              },
              "time": 1734781955,
              "interval": 71617,
              "fullRbf": true,
              "replaces": []
            }
          ],
          "interval": 23369
        }
      ]
    },
    ...
  ]
}`
        },
      }
    }
  },

];

export const restApiDocsData = [
  {
    type: 'category',
    category: 'general',
    fragment: 'general',
    title: 'General',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'general',
    httpRequestMethod: 'GET',
    fragment: 'get-difficulty-adjustment',
    title: 'GET Difficulty Adjustment',
    description: {
      default: 'Returns details about difficulty adjustment.'
    },
    urlString: '/v1/difficulty-adjustment',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: `
        const { %{0}: { difficulty } } = mempoolJS();

        const difficultyAdjustment = await difficulty.getDifficultyAdjustment();

        document.getElementById("result").textContent = JSON.stringify(difficultyAdjustment, undefined, 2);
          `,
          esModule: `
  const { %{0}: { difficulty } } = mempoolJS();

  const difficultyAdjustment = await difficulty.getDifficultyAdjustment();
  console.log(difficultyAdjustment);
          `,
          curl: `/api/v1/difficulty-adjustment`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 98.45932018381687,
  estimatedRetargetDate: 1627762478,
  remainingBlocks: 1121,
  remainingTime: 665977,
  previousRetarget: -4.807005268478962,
  nextRetargetHeight: 741888,
  timeAvg: 302328,
  adjustedTimeAvg: 302328,
  timeOffset: 0
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'general',
    httpRequestMethod: 'GET',
    fragment: 'get-price',
    title: 'GET Price',
    description: {
      default: 'Returns nito latest price denominated in main currencies.'
    },
    urlString: '/v1/prices',
    showConditions: [''],
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: ``,
          esModule: ``,
          curl: `/api/v1/prices`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  time: 1703252411,
  USD: 43753,
  EUR: 40545,
  GBP: 37528,
  CAD: 58123,
  CHF: 37438,
  AUD: 64499,
  JPY: 6218915
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'general',
    httpRequestMethod: 'GET',
    fragment: 'get-historical-price',
    title: 'GET Historical Price',
    description: {
      default: 'Returns nito historical price denominated in main currencies. Available query parameters: <code>currency</code>, <code>timestamp</code>. If no parameter is provided, the full price history for all currencies is returned.'
    },
    urlString: '/v1/historical-price?currency=EUR&timestamp=1500000000',
    showConditions: [''],
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: ``,
          esModule: ``,
          curl: `/api/v1/historical-price?currency=EUR&timestamp=1500000000`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  prices: [
    {
      "time": 1499904000,
      "EUR": 1964,
      "USD": 2254.9
    }
  ],
  exchangeRates: {
    "USDEUR": 0.92,
    "USDGBP": 0.78,
    "USDCAD": 1.36,
    "USDCHF": 0.89,
    "USDAUD": 1.53,
    "USDJPY": 149.48
  }
}
`
        },
      }
    }
  },
  {
    type: 'category',
    category: 'addresses',
    fragment: 'addresses',
    title: 'Addresses',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address',
    title: 'GET Address',
    description: {
      default: 'Returns details about an address. Available fields: <code>address</code>, <code>chain_stats</code>, and <code>mempool_stats</code>. <code>chain_stats</code> and <code>mempool_stats</code> each contain an object with <code>tx_count</code>, <code>funded_txo_count</code>, <code>funded_txo_sum</code>, <code>spent_txo_count</code>, and <code>spent_txo_sum</code>.'
    },
    urlString: '/address/:address',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const myAddress = await addresses.getAddress({ address });

        document.getElementById("result").textContent = JSON.stringify(myAddress, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);
          `,
        },
        codeSampleMainnet: {
          esModule: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          commonJS: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          curl: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          response: `{
  address: "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-transactions',
    title: 'GET Address Transactions',
    description: {
      default: 'Get transaction history for the specified address/scripthash, sorted with newest first. Returns up to 50 mempool transactions plus the first 25 confirmed transactions. You can request more confirmed transactions using an <code>after_txid</code> query parameter.'
    },
    urlString: '/address/:address/txs',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxs = await addresses.getAddressTxs({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxs = await addresses.getAddressTxs({ address });
  console.log(addressTxs);
          `,
        },
        codeSampleMainnet: {
          esModule: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          commonJS: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          curl: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          response: `[
  {
    txid: "5302358d244c8e609154c9c1ec5d1ddf2000fcc209753530f423672c6cfdd8ff",
    version: 1,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 255,
    weight: 1020,
    fee: 10000,
    status: {
      confirmed: true,
      block_height: 326148,
      block_hash: "00000000103d1acbedc9bb8ff2af8cb98a751965e784b4e1f978f3d5544c6c3c",
      block_time: 1413798020
    }
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-transactions-chain',
    title: 'GET Address Transactions Chain',
    description: {
      default: 'Get confirmed transaction history for the specified address/scripthash, sorted with newest first. Returns 25 transactions per page. More can be requested by specifying the last txid seen by the previous query.'
    },
    urlString: '/address/:address/txs/chain',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs/chain`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsChain = await addresses.getAddressTxsChain({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsChain, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsChain = await addresses.getAddressTxsChain({ address });
  console.log(addressTxsChain);
          `,
        },
        codeSampleMainnet: {
          esModule: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          commonJS: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          curl: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          response: `[
  {
    txid: "0367284f1192d6e5e33ffe70652e22cb39c7a18d20045823d18a7530de0e1fd4",
    version: 2,
    locktime: 697761,
    vin: [],
    vout: [],
    size: 221,
    weight: 884,
    fee: 331,
    status: {
      confirmed: true,
      block_height: 697782,
      block_hash: "000000000000060eb4d3e5ff8ebe7badae03132944524f102c2b847a26c58bbb",
      block_time: 1630040570
    }
  },
  ...
],`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-transactions-mempool',
    title: 'GET Address Transactions Mempool',
    description: {
      default: 'Get unconfirmed transaction history for the specified address/scripthash. Returns up to 50 transactions (no paging).'
    },
    urlString: '/address/:address/txs/mempool',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs/mempool`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsMempool = await addresses.getAddressTxsMempool({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsMempool, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
  console.log(addressTxsMempool);
          `,
        },
        codeSampleMainnet: {
          esModule: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          commonJS: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          curl: [`nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr`],
          response: `[
  {
    txid: "0367284f1192d6e5e33ffe70652e22cb39c7a18d20045823d18a7530de0e1fd4",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-utxo',
    title: 'GET Address UTXO',
    description: {
      default: 'Get the list of unspent transaction outputs associated with the address/scripthash. Available fields: <code>txid</code>, <code>vout</code>, <code>value</code>, and <code>status</code> (with the status of the funding tx).',
    },
    urlString: '/address/:address/utxo',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/utxo`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsUtxo, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
  console.log(addressTxsUtxo);
          `,
        },
        codeSampleMainnet: {
          esModule: [`nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45`],
          commonJS: [`nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45`],
          curl: [`nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45`],
          response: `[
  {
    txid: "98b4f3c7eb5b92092ac0ef8a6da58a9c304a24e37529b488d85aa4db3f9b0bca",
    vout: 0,
    status: {
      confirmed: true,
      block_height: 698642,
      block_hash: "00000000000000ac7f0c982216ce04a629ad147fcf3763012a6eba65aa634da6",
      block_time: 1630561459
    },
    value: 644951084
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-validate',
    title: 'GET Address Validation',
    description: {
      default: 'Returns whether an address is valid or not. Available fields: <code>isvalid</code> (boolean), <code>address</code> (string), <code>scriptPubKey</code> (string), <code>isscript</code> (boolean), <code>iswitness</code> (boolean), <code>witness_version</code> (numeric, optional), and <code>witness_program</code> (string, optional).',
    },
    urlString: '/v1/validate-address/:address',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/validate-address/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [`nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45`],
          response: `{
  isvalid: true,
  address: "nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45",
  scriptPubKey: "76a914c825a1ecf2a6830c4401620c3a16f1995057c2ab88ac",
  isscript: false,
  iswitness: false
}`
        },
      }
    }
  },
  {
    type: 'category',
    fragment: 'blocks',
    title: 'Blocks',
    showConditions: bitcoinNetworks
  },
  {
    options: { electrsOnly: true },
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block',
    title: 'GET Block',
    description: {
      default: 'Returns details about a block.',
    },
    urlString: '/block/:hash',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const block = await blocks.getBlock({ hash });

        document.getElementById("result").textContent = JSON.stringify(block, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const block = await blocks.getBlock({ hash });
  console.log(block);
          `,
        },
        codeSampleMainnet: {
          esModule: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20'],
          commonJS: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20'],
          curl: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20'],
          response: `{
  "id": "000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20",
  "height": 363366,
  "version": 2,
  "timestamp": 1435766771,
  "tx_count": 494,
  "size": 286494,
  "weight": 1145976,
  "merkle_root": "7915699e8be42c9ad1ab50424cf3063072d3c5ed42edc77e7a01d9051fa18e89",
  "previousblockhash": "000000000000080c140a6a4b74828d3756c98b8c7da48cf0437f597bdbc80801",
  "mediantime": 1435763435,
  "nonce": 2892644888,
  "bits": 404111758,
  "difficulty": 49402014931.2275
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-v1',
    title: 'GET Block (v1)',
    description: {
      default: 'Returns details about a block using Nito Mempool\'s Explorer\'s Node.js backend.',
    },
    urlString: '/v1/block/:hash',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/block/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const block = await blocks.getBlock({ hash });

        document.getElementById("result").textContent = JSON.stringify(block, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const block = await blocks.getBlock({ hash });
  console.log(block);
          `,
        },
        codeSampleMainnet: {
          esModule: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20'],
          commonJS: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20'],
          curl: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20'],
          response: `{
  "id": "000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20",
  "height": 363366,
  "version": 2,
  "timestamp": 1435766771,
  "bits": 404111758,
  "nonce": 2892644888,
  "difficulty": 49402014931.22746,
  "merkle_root": "7915699e8be42c9ad1ab50424cf3063072d3c5ed42edc77e7a01d9051fa18e89",
  "tx_count": 494,
  "size": 286494,
  "weight": 1145976,
  "previousblockhash": "000000000000080c140a6a4b74828d3756c98b8c7da48cf0437f597bdbc80801",
  "mediantime": 1435763435,
  "extras": {
    "totalFees": "5949764",
    "medianFee": 14,
    "feeRange": [
      0,
      0,
      1,
      14,
      38,
      48,
      261
    ],
    "reward": "2505949764",
    "pool": {
      "id": 0,
      "name": "Unknown",
      "slug": "unknown",
      "minerNames": null
    },
    "avgFee": "12068",
    "avgFeeRate": 20,
    "coinbaseRaw": "03668b050455940ee2ebbc03100000046d",
    "coinbaseAddress": "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr",
    "coinbaseAddresses": [
      "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr"
    ],
    "coinbaseSignature": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 45160ea9d45f6edefef3977ac0b2cdcc29aa594a OP_EQUALVERIFY OP_CHECKSIG",
    "coinbaseSignatureAscii": "...",
    "avgTxSize": 579.57,
    "totalInputs": 1424,
    "totalOutputs": 1764,
    "totalOutputAmt": 531126071491,
    "medianFeeAmt": "10000",
    "feePercentiles": [
      0,
      735,
      10000,
      10000,
      10000,
      20000,
      300000
    ],
    "segwitTotalTxs": 0,
    "segwitTotalSize": 0,
    "segwitTotalWeight": 0,
    "header": "02000000ce0782217396e8f2e91e0b76a8a245cff7f13efab645c51000000000000000006c684bb0477609cbc986385c38fc628cce68f7d52e26b466e3ba5ef07bb83c9df30f94558e41161818426aac",
    "utxoSetChange": 340,
    "utxoSetSize": "21180314",
    "totalInputAmt": 531132021255,
    "virtualSize": 286494,
    "firstSeen": null,
    "orphans": [],
    "matchRate": null,
    "expectedFees": null,
    "expectedWeight": null
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-header',
    title: 'GET Block Header',
    description: {
      default: 'Returns the hex-encoded block header.'
    },
    urlString: '/block/:hash/header',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/header`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockHeader = await blocks.getBlockHeader({ height: 0 });

        document.getElementById("result").textContent = JSON.stringify(blockHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockHeader = await blocks.getBlockHeader({ height: 0 });
  console.log(blockHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: ['90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131'],
          commonJS: ['90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131'],
          curl: ['90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131'],
          response: `040000202c04d4c450187d1da9b1bc23ba47d67fe028d22486fd0c00000000000000000059a3a33d4642c799af9f54a4dd351fff9130e6a89d4e251130c60064878616e906b5ea60ce9813173a25caf3`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-height',
    title: 'GET Block Height',
    description: {
      default: 'Returns the hash of the block currently at <code>:height</code>.'
    },
    urlString: '/block-height/:height',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block-height/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();
        const hash = '%{1}';
        const blockHeight = await blocks.getBlockHeight({ height: 0 });
        document.getElementById("result").textContent = JSON.stringify(blockHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();
  const hash = '%{1}';
  const blockHeight = await blocks.getBlockHeight({ height: 0 });
  console.log(blockHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: ['615615'],
          commonJS: ['615615'],
          curl: ['615615'],
          response: `0000000000062f63d314c901d27f867844106121404230b7f1dbff5bf3a3bfac`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-timestamp',
    title: 'GET Block Timestamp',
    description: {
      default: 'Returns the height and the hash of the block closest to the given <code>:timestamp</code>.'
    },
    urlString: '/v1/mining/blocks/timestamp/:timestamp',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/timestamp/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: ['1672531200'],
          response: `{
  height: 769786,
  hash: "000000000000080c140a6a4b74828d3756c98b8c7da48cf0437f597bdbc80801",
  timestamp: "2022-12-31T23:30:31.000Z"
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-raw',
    title: 'GET Block Raw',
    description: {
      default: 'Returns the raw block representation in binary.'
    },
    urlString: '/block/:hash/raw',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/raw`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockRaw = await blocks.getBlockRaw({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockRaw, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockRaw = await blocks.getBlockRaw({ hash });
  console.log(blockRaw);
          `,
        },
        codeSampleMainnet: {
          esModule: ['90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131'],
          commonJS: ['90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131'],
          curl: ['90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131'],
          response: '',
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-status',
    title: 'GET Block Status',
    description: {
      default: 'Returns the confirmation status of a block. Available fields: <code>in_best_chain</code> (boolean, false for orphaned blocks), <code>next_best</code> (the hash of the next block, only available for blocks in the best chain).'
    },
    urlString: '/block/:hash/status',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/status`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockStatus = await blocks.getBlockStatus({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockStatus, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockStatus = await blocks.getBlockStatus({ hash });
  console.log(blockStatus);
          `,
        },
        codeSampleMainnet: {
          esModule: ['90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131'],
          commonJS: ['90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131'],
          curl: ['90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131'],
          response: `{
  in_best_chain: true,
  height: 690557,
  next_best: "000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20"
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-tip-height',
    title: 'GET Block Tip Height',
    description: {
      default: 'Returns the height of the last block.'
    },
    urlString: '/blocks/tip/height',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/tip/height`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const blocksTipHeight = await blocks.getBlocksTipHeight();

        document.getElementById("result").textContent = JSON.stringify(blocksTipHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const blocksTipHeight = await blocks.getBlocksTipHeight();
  console.log(blocksTipHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `698767`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-tip-hash',
    title: 'GET Block Tip Hash',
    description: {
      default: 'Returns the hash of the last block.'
    },
    urlString: '/blocks/tip/hash',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/tip/hash`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const blocksTipHash = await blocks.getBlocksTipHash();

        document.getElementById("result").textContent = JSON.stringify(blocksTipHash, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const blocksTipHash = await blocks.getBlocksTipHash();
  console.log(blocksTipHash);
          `,
        },
        codeSampleMainnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `000000000009e93bc343e97c0ccef77eb6592d98a039d2e15a4157cd5b826138`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-transaction-id',
    title: 'GET Block Transaction ID',
    description: {
      default: 'Returns the transaction at index <code>:index</code> within the specified block.'
    },
    urlString: '/block/:hash/txid/:index',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txid/%{2}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxid = await blocks.getBlockTxid({ hash, index: %{2} });

        document.getElementById("result").textContent = JSON.stringify(blockTxid, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxid = await blocks.getBlockTxid({ hash, index: %{2} });
  console.log(blockTxid);
          `,
        },
        codeSampleMainnet: {
          esModule: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20', '218'],
          commonJS: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20', '218'],
          curl: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20', '218'],
          response: `0fa6da60e484941f255cbb025c3d6440e5a7e970119e899b4065c7999360e406`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-transaction-ids',
    title: 'GET Block Transaction IDs',
    description: {
      default: 'Returns a list of all txids in the block.'
    },
    urlString: '/block/:hash/txids',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txids`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxids = await blocks.getBlockTxids({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockTxids, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxids = await blocks.getBlockTxids({ hash });
  console.log(blockTxids);
          `,
        },
        codeSampleMainnet: {
          esModule: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20', '218'],
          commonJS: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20', '218'],
          curl: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20', '218'],
          response: `[
  "7915699e8be42c9ad1ab50424cf3063072d3c5ed42edc77e7a01d9051fa18e89",
  "9e9635d8f165ef8c0c5754ac971268ee96e934f921bf39ca898c85e4b366ac20",
  ...,
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-transactions',
    title: 'GET Block Transactions',
    description: {
      default: 'Returns a list of transactions in the block (up to 25 transactions beginning at <code>start_index</code>). Transactions returned here do not have the <code>status</code> field, since all the transactions share the same block and confirmation status.'
    },
    urlString: '/block/:hash/txs[/:start_index]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txs`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxs = await blocks.getBlockTxs({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxs = await blocks.getBlockTxs({ hash });
  console.log(blockTxs);
          `,
        },
        codeSampleMainnet: {
          esModule: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20'],
          commonJS: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20'],
          curl: ['000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20'],
          response: `[
  {
    txid: "7915699e8be42c9ad1ab50424cf3063072d3c5ed42edc77e7a01d9051fa18e89",
    version: 1,
    locktime: 0,
    vin: [],
    vout: [],
    size: 102,
    weight: 408,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 363366,
      block_hash: "000000000000001abd37f60c1b6695a5a6e070e639019427fc77f5a8741d0b20",
      block_time: 1435766771
    }
  },
  ...
]`
        },
      }
    }
  },
  {
    options: { electrsOnly: true },
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks',
    title: 'GET Blocks',
    description: {
      default: 'Returns details on the past 10 blocks. If <code>:startHeight</code> is specified, the 10 blocks before (and including) <code>:startHeight</code> are returned.'
    },
    urlString: '/blocks[/:startHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: ['400000'],
          commonJS: ['400000'],
          curl: ['400000'],
          response: `[
  {
    "id": "00000000000005ab347f9640198cf10187ac2272494d74ed4b175d18e7f2fd0e",
    "height": 400000,
    "version": 536870912,
    "timestamp": 1648829449,
    "tx_count": 1627,
    "size": 1210916,
    "weight": 3993515,
    "merkle_root": "0367284f1192d6e5e33ffe70652e22cb39c7a18d20045823d18a7530de0e1fd4",
    "previousblockhash": "000000000000060eb4d3e5ff8ebe7badae03132944524f102c2b847a26c58bbb",
    "mediantime": 1648827418,
    "nonce": 3580664066,
    "bits": 386521239,
    "difficulty": 28587155782195.1
  },
  {
    "id": "000000000000060eb4d3e5ff8ebe7badae03132944524f102c2b847a26c58bbb",
    "height": 729999,
    "version": 793796608,
    "timestamp": 1648828946,
    "tx_count": 2574,
    "size": 1481957,
    "weight": 3993485,
    "merkle_root": "9e9635d8f165ef8c0c5754ac971268ee96e934f921bf39ca898c85e4b366ac20",
    "previousblockhash": "00000000000000322b892cc337a5c572b1d637aebc2c039784a3ee317651c10c",
    "mediantime": 1648827210,
    "nonce": 3477019455,
    "bits": 386521239,
    "difficulty": 28587155782195.1
  },
  ...
]`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-v1',
    title: 'GET Blocks (v1)',
    description: {
      default: 'Returns details on the past 15 blocks from Nito Mempool\'s Explorer\'s Node.js backend. Includes fee and mining details in an <code>extras</code> field. If <code>:startHeight</code> is specified, the past 15 blocks before (and including) <code>:startHeight</code> are returned.'
    },
    urlString: '/v1/blocks[/:startHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: ['400000'],
          commonJS: ['400000'],
          curl: ['400000'],
          response: `[
  {
    "id": "00000000000005ab347f9640198cf10187ac2272494d74ed4b175d18e7f2fd0e",
    "height": 400000,
    "version": 536870912,
    "timestamp": 1648829449,
    "bits": 386521239,
    "nonce": 3580664066,
    "difficulty": 28587155782195.1,
    "merkle_root": "0367284f1192d6e5e33ffe70652e22cb39c7a18d20045823d18a7530de0e1fd4",
    "tx_count": 1627,
    "size": 1210916,
    "weight": 3993515,
    "previousblockhash": "000000000000060eb4d3e5ff8ebe7badae03132944524f102c2b847a26c58bbb",
    "mediantime": 1648827418,
    "extras": {
      "totalFees": "16321983",
      "medianFee": 11,
      "feeRange": [1, 11, 11, 11, 18, 21, 660],
      "reward": "641321983",
      "pool": {
        "id": 105,
        "name": "NitroPool",
        "slug": "nitropool_xsm8x2an",
        "minerNames": null
      },
      "avgFee": "10038",
      "avgFeeRate": 16,
      "coinbaseRaw": "0390230b1362696e616e63652f383038e0006f02cd583765fabe6d6d686355577affaad03015e732428a927a5d2d842471b350394139616bcb4401d804000000000000001a750000c9ad0000",
      "coinbaseAddress": "nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45",
      "coinbaseAddresses": [
        "nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45"
      ],
      "coinbaseSignature": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 c499d0604392cc2051d7476056647d1c1bfc3f38 OP_EQUALVERIFY OP_CHECKSIG",
      "coinbaseSignatureAscii": "...",
      "avgTxSize": 744,
      "totalInputs": 6249,
      "totalOutputs": 6768,
      "totalOutputAmt": 1314305994870,
      "medianFeeAmt": "3182",
      "feePercentiles": [313, 2086, 2538, 3182, 5625, 14136, 990660],
      "segwitTotalTxs": 1314,
      "segwitTotalSize": 1031785,
      "segwitTotalWeight": 3277099,
      "header": "000000208f317dddad0dd22d649ef20a1eef1245d7f883fbf6b608000000000000000000bc4f7bdee359a4be8e3380d61281179654dcd65d5109b7937f60c0d6bc44a3ef0924476297d8091702996cd5",
      "utxoSetChange": 519,
      "utxoSetSize": "80390138",
      "totalInputAmt": 1314322316853,
      "virtualSize": 998378.75,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-bulk',
    title: 'GET Blocks (Bulk)',
    description: {
      default: '<p>Returns details on the range of blocks between <code>:minHeight</code> and <code>:maxHeight</code>, inclusive, up to 10 blocks. If <code>:maxHeight</code> is not specified, it defaults to the current tip.</p><p>To return data for more than 10 blocks, consider becoming an contacting support.</p>'
    },
    urlString: '/v1/blocks-bulk/:minHeight[/:maxHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/blocks-bulk/%{1}/%{2}`,
          commonJS: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [100000,100000],
          response: `[
  {
    "height": 100000,
    "hash": "d5e23827707bef310a8827be01a666b42aaa74d5f669ba767eebad355e92f8d8",
    "timestamp": 1293623863,
    "median_timestamp": 1293622620,
    "previous_block_hash": "9e9635d8f165ef8c0c5754ac971268ee96e934f921bf39ca898c85e4b366ac20",
    "difficulty": 14484.1623612254,
    "header": "0100000050120119172a610421a6c3011dd330d9df07b63616c2cc1f1cd00200000000006657a9252aacd5c0b2940996ecff952228c3067cc38d4885efb5a4ac4247e9f337221b4d4c86041b0f2b5710",
    "version": 1,
    "bits": 453281356,
    "nonce": 274148111,
    "size": 957,
    "weight": 3828,
    "tx_count": 4,
    "merkle_root": "94167cdbac9b75744eb2768d4318d09404dbf1cabd696c4823f5760d67c28399",
    "reward": "5000000000",
    "total_fee_amt": 0,
    "avg_fee_amt": 0,
    "median_fee_amt": 0,
    "fee_amt_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "avg_fee_rate": 0,
    "median_fee_rate": 0,
    "fee_rate_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "total_inputs": 3,
    "total_input_amt": 5301000000,
    "total_outputs": 6,
    "total_output_amt": 5301000000,
    "segwit_total_txs": 0,
    "segwit_total_size": 0,
    "segwit_total_weight": 0,
    "avg_tx_size": 185.25,
    "utxoset_change": 3,
    "utxoset_size": 71888,
    "coinbase_raw": "044c86041b020602",
    "coinbase_address": null,
    "coinbase_signature": "OP_PUSHBYTES_65 041b0e8c2567c12536aa13357b79a073dc4444acb83c4ec7a0e2f99dd7457516c5817242da796924ca4e99947d087fedf9ce467cb9f7c6287078f801df276fdf84 OP_CHECKSIG",
    "coinbase_signature_ascii": "\u0004L�\u0004\u001b\u0002\u0006\u0002",
    "pool_slug": "unknown",
    "orphans": []
  }
]`,
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks',
    title: 'GET Blocks',
    description: {
      default: 'Returns details on the past 10 blocks with fee and mining details in an <code>extras</code> field. If <code>:startHeight</code> is specified, the past 10 blocks before (and including) <code>:startHeight</code> are returned.'
    },
    urlString: '/blocks[/:startHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-v1',
    title: 'GET Blocks (v1)',
    description: {
      default: 'Returns details on the past 15 blocks from Nito Mempool\'s Explorer\'s Node.js backend. If <code>:startHeight</code> is specified, the past 15 blocks before (and including) <code>:startHeight</code> are returned.'
    },
    urlString: '/v1/blocks[/:startHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: emptyCodeSample,
      }
    }
  },
  {
    type: 'category',
    category: 'mining',
    fragment: 'mining',
    title: 'Mining',
    showConditions: bitcoinNetworks
  },
 {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pools',
    title: 'GET Mining Pools',
    description: {
      default: 'Returns a list of all known mining pools ordered by blocks found over the specified trailing <code>:timePeriod</code>.</p><p>Leave <code>:timePeriod</code> unspecified to get all available data, or specify one of the following values: ' + miningTimeIntervals + '.'
    },
    urlString: '/v1/mining/pools[/:timePeriod]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pools/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `{
  "pools": [
  {
    "poolId": 111,
    "name": "minto.day",
    "link": "",
    "blockCount": 194,
    "rank": 1,
    "emptyBlocks": 0,
    "slug": "minto.day_3kfklgcr"
  },
  {
    "poolId": 36,
    "name": "zpool.ca",
    "link": "",
    "blockCount": 154,
    "rank": 2,
    "emptyBlocks": 0,
    "slug": "zpool.ca_8ueyaxxh"
  },
  {
    "poolId": 44,
    "name": "Miningcore",
    "link": "",
    "blockCount": 138,
    "rank": 3,
    "emptyBlocks": 0,
    "slug": "miningcore_ntap2yfr"
  },
  ...
  "blockCount": 1005,
  "lastEstimatedHashrate": 230086716765559200000
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool',
    title: 'GET Mining Pool',
    description: {
      default: '<p>Returns details about the mining pool specified by <code>:slug</code>.</p>'
    },
    urlString: '/v1/mining/pool/:slug',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`slushpool`],
          response: `{
  "pool": {
    "id": 43,
    "name": "Mining4People",
    "link": "",
    "addresses": [
      "nito1qk8dygzp5ywmdsmpe5cs7ak6vj4gm6mwc4j7v45",
      "nito1qded8zy6xdnzpk0nwv8lwks465n95qm3kfklgcr"
    ],
    "regexes": [
      "/Miningcore/"
    ],
    "slug": "mining4people_9cvsdjct"
  },
  "blockCount": {
    "all": 679,
    "24h": 8,
    "1w": 56
  },
  "blockShare": {
    "all": 0.06015770355275981,
    "24h": 0.05333333333333334,
    "1w": 0.055666003976143144
  },
  "estimatedHashrate": 12448077385930390000,
  "reportedHashrate": null
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool-hashrates',
    title: 'GET Mining Pool Hashrates',
    description: {
      default: '<p>Returns average hashrates (and share of total hashrate) of mining pools active in the specified trailing <code>:timePeriod</code>, in descending order of hashrate.</p><p>Leave <code>:timePeriod</code> unspecified to get all available data, or specify any of the following time periods: ' + miningTimeIntervals.substr(52) + '.</p>'
    },
    urlString: '/v1/mining/hashrate/pools/[:timePeriod]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/hashrate/pools/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "timestamp": 1650240000,
    "avgHashrate": 38258816322322470000,
    "share": 0.185366,
    "poolName": "minto.day"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 28996155528497033000,
    "share": 0.140488,
    "poolName": "zpool.ca"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 29801604293177496000,
    "share": 0.14439,
    "poolName": "Miningcore"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 21747116646372770000,
    "share": 0.105366,
    "poolName": "SuperAxePool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 26579809234455600000,
    "share": 0.12878,
    "poolName": "NitroPool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 19934856925841707000,
    "share": 0.0965854,
    "poolName": "ashampool.org"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 11679007087866855000,
    "share": 0.0565854,
    "poolName": "Mining4People"
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool-hashrate',
    title: 'GET Mining Pool Hashrate',
    description: {
      default: 'Returns all known hashrate data for the mining pool specified by <code>:slug</code>. Hashrate values are weekly averages.'
    },
    urlString: '/v1/mining/pool/:slug/hashrate',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}/hashrate`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`foundryusa`],
          response: `[
  {
    "timestamp": 1647216000,
    "avgHashrate": 39126788325841880000,
    "share": 0.195312,
    "poolName": "minto.day"
  },
  {
    "timestamp": 1647302400,
    "avgHashrate": 42038778612166990000,
    "share": 0.208941,
    "poolName": "minto.day"
  },
  {
    "timestamp": 1647820800,
    "avgHashrate": 40677922193000910000,
    "share": 0.196597,
    "poolName": "minto.day"
  },
  {
    "timestamp": 1647907200,
    "avgHashrate": 40210989932016525000,
    "share": 0.194707,
    "poolName": "minto.day"
  },
  {
    "timestamp": 1648425600,
    "avgHashrate": 39336856807414260000,
    "share": 0.194605,
    "poolName": "minto.day"
  },
  {
    "timestamp": 1648512000,
    "avgHashrate": 39391244745360090000,
    "share": 0.193487,
    "poolName": "minto.day"
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool-blocks',
    title: 'GET Mining Pool Blocks',
    description: {
      default: 'Returns past 10 blocks mined by the specified mining pool (<code>:slug</code>) before the specified <code>:blockHeight</code>. If no <code>:blockHeight</code> is specified, the mining pool\'s 10 most recent blocks are returned.'
    },
    urlString: '/v1/mining/pool/:slug/blocks/[:blockHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}/blocks/%{2}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`luxor`,`400000`],
          response: `[
  {
    "id": "00000000103d1acbedc9bb8ff2af8cb98a751965e784b4e1f978f3d5544c6c3c",
    "timestamp": 1648778242,
    "height": 729910,
    "version": 536895488,
    "bits": 386521239,
    "nonce": 1708647181,
    "difficulty": 28587155782195.14,
    "merkle_root": "7915699e8be42c9ad1ab50424cf3063072d3c5ed42edc77e7a01d9051fa18e89",
    "tx_count": 1808,
    "size": 1595444,
    "weight": 3992846,
    "previousblockhash": "00000000103d1acbedc9bb8ff2af8cb98a751965e784b4e1f978f3d5544c6c3c",
    "extras": {
      "coinbaseRaw": "0336230b315c20506f7765726564206279204c75786f722054656368205c000000002103a960b06341e200000e744596150000000000",
      "medianFee": 1,
      "reward": "628988802",
      "totalFees": "3988802",
      "pool": {
        "id": 4
      }
    }
  },
  {
    "id": "00000000000002cde633f5f4f5e77fe4e42cda8f7e803b661f53119a2a0ac66b",
    "timestamp": 1648717740,
    "height": 729820,
    "version": 536870912,
    "bits": 386521239,
    "nonce": 1608169168,
    "difficulty": 28587155782195.14,
    "merkle_root": "9046c7341be878bdcb9cc242c5f41434716133695ef17c3abc0a596910e55593",
    "tx_count": 1425,
    "size": 729585,
    "weight": 1954155,
    "previousblockhash": "0000000000062f63d314c901d27f867844106121404230b7f1dbff5bf3a3bfac",
    "extras": {
      "coinbaseRaw": "03dc220b315c20506f7765726564206279204c75786f722054656368205c00000000e5ae4908ac1f20df00000410c830000000000000",
      "medianFee": 8,
      "reward": "630138805",
      "totalFees": "5138805",
      "pool": {
        "id": 4
      }
    }
  },
  {
    "id": "00000000000001678b438dda064fe64d799368d27f21b03c1c3c904861cb40fe",
    "timestamp": 1648653948,
    "height": 729714,
    "version": 549453824,
    "bits": 386547904,
    "nonce": 883606929,
    "difficulty": 27452707696466.39,
    "merkle_root": "06b9f35b85ec5e4816cd0fc4c5e73aee45822b024238a718f3c50c61234804f2",
    "tx_count": 1709,
    "size": 1434271,
    "weight": 3993013,
    "previousblockhash": "000000000009e93bc343e97c0ccef77eb6592d98a039d2e15a4157cd5b826138",
    "extras": {
      "coinbaseRaw": "0372220b315c20506f7765726564206279204c75786f722054656368205c0000000063349a9b3d185fed000007e7092a000000000000",
      "medianFee": 3,
      "reward": "632350743",
      "totalFees": "7350743",
      "pool": {
        "id": 4
      }
    }
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-hashrate',
    title: 'GET Hashrate',
    description: {
      default: '<p>Returns network-wide hashrate and difficulty figures over the specified trailing <code>:timePeriod</code>:</p><ul><li>Current (real-time) hashrate</li><li>Current (real-time) difficulty</li><li>Historical daily average hashrates</li><li>Historical difficulty</li></ul><p>Valid values for <code>:timePeriod</code> are ' + miningTimeIntervals.substr(52) + '. If no time interval is specified, all available data is returned.</p><p>Be sure that <code>INDEXING_BLOCKS_AMOUNT</code> is set properly in your backend config so that enough blocks are indexed to properly serve your request.</p>'
    },
    urlString: '/v1/mining/hashrate/[:timePeriod]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/hashrate/3d`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652486400,
      "avgHashrate": 236499762108771800000
    },
    {
      "timestamp": 1652572800,
      "avgHashrate": 217473276787331300000
    },
    {
      "timestamp": 1652659200,
      "avgHashrate": 189877203506913000000
    }
  ],
  "difficulty": [
    {
      "timestamp": 1652468330,
      "difficulty": 31251101365711.12,
      "height": 736249
    }
  ],
  "currentHashrate": 252033247355212300000,
  "currentDifficulty": 31251101365711.12
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-difficulty-adjustments',
    title: 'GET Difficulty Adjustments',
    description: {
      default: '<p>Returns the record of difficulty adjustments over the specified trailing <code>:interval</code>:</p><ul><li>Block timestamp</li><li>Block height</li><li>Difficulty</li><li>Difficulty change</li></ul><p>If no time interval is specified, all available data is returned.'
    },
    urlString: '/v1/mining/difficulty-adjustments/[:interval]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/difficulty-adjustments/1m`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  [
    1703311464,
    822528,
    72006146478567.1,
    1.06983
  ],
  [
    1702180644,
    820512,
    67305906902031.39,
    0.990408
  ],
  [
    1700957763,
    818496,
    67957790298897.88,
    1.0507
  ]
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-reward-stats',
    title: 'GET Reward Stats',
    description: {
      default: 'Returns block reward and total transactions confirmed for the past <code>:blockCount</code> blocks.'
    },
    urlString: '/v1/mining/reward-stats/:blockCount',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/reward-stats/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 736556,
  "endBlock": 736655,
  "totalReward": "63811748254",
  "totalFee": "1311748254",
  "totalTx": "164216"
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-fees',
    title: 'GET Block Fees',
    description: {
      default: '<p>Returns average total fees for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and fee amounts are exact (not averages). For the <code>1w</code> time period, fees may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, fees are averages.</p>'
    },
    urlString: '/v1/mining/blocks/fees/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/fees/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 735644,
    "timestamp": 1652119111,
    "avgFees": "24212890"
  },
  {
    "avgHeight": 735646,
    "timestamp": 1652120252,
    "avgFees": "21655996"
  },
  {
    "avgHeight": 735648,
    "timestamp": 1652121214,
    "avgFees": "20678859"
  },
  {
    "avgHeight": 735649,
    "timestamp": 1652121757,
    "avgFees": "21020140"
  },
  {
    "avgHeight": 735650,
    "timestamp": 1652122367,
    "avgFees": "23064200"
  },
  {
    "avgHeight": 735652,
    "timestamp": 1652122893,
    "avgFees": "17620723"
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-rewards',
    title: 'GET Block Rewards',
    description: {
      default: '<p>Returns average block rewards for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and block rewards are exact (not averages). For the <code>1w</code> time period, block rewards may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, block rewards are averages.</p>'
    },
    urlString: '/v1/mining/blocks/rewards/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/rewards/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 599992,
    "timestamp": 1571438412,
    "avgRewards": "1260530933"
  },
  {
    "avgHeight": 600000,
    "timestamp": 1571443398,
    "avgRewards": "1264314538"
  },
  {
    "avgHeight": 725441,
    "timestamp": 1646139035,
    "avgRewards": "637067563"
  },
  {
    "avgHeight": 725585,
    "timestamp": 1646222444,
    "avgRewards": "646519104"
  },
  {
    "avgHeight": 725727,
    "timestamp": 1646308374,
    "avgRewards": "638709605"
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-feerates',
    title: 'GET Block Feerates',
    description: {
      default: 'Returns average feerate percentiles for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and percentiles are exact (not averages). For the <code>1w</code> time period, percentiles may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, percentiles are averages.'
    },
    urlString: '/v1/mining/blocks/fee-rates/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/fee-rates/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "avgHeight": 732152,
    "timestamp": 1650132959,
    "avgFee_0": 1,
    "avgFee_10": 2,
    "avgFee_25": 2,
    "avgFee_50": 3,
    "avgFee_75": 4,
    "avgFee_90": 8,
    "avgFee_100": 393
  },
  {
    "avgHeight": 732158,
    "timestamp": 1650134432,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 2,
    "avgFee_50": 4,
    "avgFee_75": 6,
    "avgFee_90": 10,
    "avgFee_100": 240
  },
  {
    "avgHeight": 732161,
    "timestamp": 1650135818,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 2,
    "avgFee_75": 5,
    "avgFee_90": 8,
    "avgFee_100": 251
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-sizes-weights',
    title: 'GET Block Sizes and Weights',
    description: {
      default: '<p>Returns average size (bytes) and average weight (weight units) for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and figures are exact (not averages). For the <code>1w</code> time period, figures may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, figures are averages.</p>'
    },
    urlString: '/v1/mining/blocks/sizes-weights/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/sizes-weights/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 576650,
      "timestamp": 1558212081,
      "avgSize": 1271404
    },
    {
      "avgHeight": 576715,
      "timestamp": 1558246272,
      "avgSize": 1105893
    },
    {
      "avgHeight": 576797,
      "timestamp": 1558289379,
      "avgSize": 1141071
    },
    {
      "avgHeight": 576885,
      "timestamp": 1558330184,
      "avgSize": 1108166
    },
    ...
  ],
  "weights": [
    {
      "avgHeight": 576650,
      "timestamp": 1558212081,
      "avgWeight": 3994002
    },
    {
      "avgHeight": 576715,
      "timestamp": 1558246272,
      "avgWeight": 3756312
    },
    {
      "avgHeight": 576797,
      "timestamp": 1558289379,
      "avgWeight": 3719625
    },
    {
      "avgHeight": 576885,
      "timestamp": 1558330184,
      "avgWeight": 3631381
    },
    ...
  ]
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-predictions',
    title: 'GET Block Predictions',
    description: {
      default: '<p>Returns average block health in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' + miningTimeIntervals + '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and figures are exact (not averages). For the <code>1w</code> time period, figures may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, figures are averages.</p>'
    },
    urlString: ['/v1/mining/blocks/predictions/:timePeriod'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/predictions/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `[
  [
    1687247274,
    777625,
    100
  ],
  [
    1687066238,
    788621,
    99.85
  ],
  [
    1687263518,
    795182,
    99.46
  ],
  [
    1687312271,
    795260,
    100
  ],
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-audit-score',
    title: 'GET Block Audit Score',
    description: {
      default: 'Returns the block audit score for the specified <code>:blockHash</code>. Available fields: <code>hash</code>, <code>matchRate</code>, <code>expectedFees</code>, and <code>expectedWeight</code>.'
    },
    urlString: ['/v1/mining/blocks/audit/score/:blockHash'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/audit/score/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`0000000000000365ffc3597388318be0010e24ad98513a885cbf766cdf134719`],
          response: `{
  hash: "0000000000000365ffc3597388318be0010e24ad98513a885cbf766cdf134719",
  matchRate: 99.66,
  expectedFees: 12090955,
  expectedWeight: 3991988
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-audit-scores',
    title: 'GET Blocks Audit Scores',
    description: {
      default: 'Returns blocks audit score for the past 16 blocks. If <code>:startHeight</code> is specified, the past 15 blocks before (and including) <code>:startHeight</code> are returned. Available fields: <code>hash</code>, <code>matchRate</code>, <code>expectedFees</code>, and <code>expectedWeight</code>.'
    },
    urlString: ['/v1/mining/blocks/audit/scores/:startHeight'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/audit/scores/%{1}`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`820000`],
          response: `[
  {
    hash: "000000000000013bba11e67273bda2c6d760d2dcde4e8f7f4cee037ecad7782d",
    matchRate: 100,
    expectedFees: 225828975,
    expectedWeight: 3991756
  },
  {
    hash: "00000000000000ac7f0c982216ce04a629ad147fcf3763012a6eba65aa634da6",
    matchRate: 100,
    expectedFees: 295107022,
    expectedWeight: 3991752
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-audit-summary',
    title: 'GET Block Audit Summary',
    description: {
      default: 'Returns the block audit summary for the specified <code>:blockHash</code>. Available fields: <code>height</code>, <code>id</code>, <code>timestamp</code>, <code>template</code>, <code>missingTxs</code>, <code>addedTxs</code>, <code>freshTxs</code>, <code>sigopTxs</code>, <code>fullrbfTxs</code>, <code>acceleratedTxs</code>, <code>matchRate</code>, <code>expectedFees</code>, and <code>expectedWeight</code>.'
    },
    urlString: ['/v1/block/:blockHash/audit-summary'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/block/%{1}/audit-summary`,
          commonJS: ``,
          esModule: ``
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`00000000000001678b438dda064fe64d799368d27f21b03c1c3c904861cb40fe`],
          response: `{
  height: 822418,
  id: "00000000000001678b438dda064fe64d799368d27f21b03c1c3c904861cb40fe",
  timestamp: 1703262962,
  template: [
    {
      txid: "06b9f35b85ec5e4816cd0fc4c5e73aee45822b024238a718f3c50c61234804f2",
      fee: 92000,
      vsize: 140.25,
      value: 354245800,
      rate: 655.9714795008913,
      flags: 1099511631881
    },
    ...
  ],
  missingTxs: [],
  addedTxs: [
    "fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b",
    "d5e23827707bef310a8827be01a666b42aaa74d5f669ba767eebad355e92f8d8",
    ...
  ],
  freshTxs: [
    "9046c7341be878bdcb9cc242c5f41434716133695ef17c3abc0a596910e55593"
  ],
  sigopTxs: [],
  fullrbfTxs: [
    "597bf60ec0ea6a3b9428a63dfe5ac1cb86d44e91ef1f91515d5629793f0c500a",
    "0367284f1192d6e5e33ffe70652e22cb39c7a18d20045823d18a7530de0e1fd4",
    ...
  ],
  acceleratedTxs: [],
  matchRate: 100,
  expectedFees: 169464627,
  expectedWeight: 3991702
}`
        },
      }
    }
  },
  {
    type: 'category',
    category: 'fees',
    fragment: 'fees',
    title: 'Fees',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'fees',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-blocks-fees',
    title: 'GET Mempool Blocks Fees',
    description: {
      default: 'Returns current mempool as projected blocks.'
    },
    urlString: '/v1/fees/mempool-blocks',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/mempool-blocks`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const feesMempoolBlocks = await fees.getFeesMempoolBlocks();

        document.getElementById("result").textContent = JSON.stringify(feesMempoolBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
  console.log(feesMempoolBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 873046,
    blockVSize: 746096.5,
    nTx: 863,
    totalFees: "8875608",
    medianFee: 10.79646017699115,
    feeRange: [
      1,
      2.4242424242424243,
      8.107816711590296,
      10.148014440433213,
      11.053311793214863,
      12.041811846689896,
      14.930957683741648,
      302.11480362537765
    ]
  }
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'fees',
    httpRequestMethod: 'GET',
    fragment: 'get-recommended-fees',
    title: 'GET Recommended Fees',
    description: {
      default: 'Returns our currently suggested fees for new transactions.'
    },
    urlString: '/v1/fees/recommended',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/recommended`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const feesRecommended = await fees.getFeesRecommended();

        document.getElementById("result").textContent = JSON.stringify(feesRecommended, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const feesRecommended = await fees.getFeesRecommended();
  console.log(feesRecommended);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'fees',
    httpRequestMethod: 'GET',
    fragment: 'get-recommended-fees-precise',
    title: 'GET Recommended Fees (Precise)',
    description: {
      default: 'Returns our currently-suggested feerates with up to 3 decimal places, including sub-sat feerates down to 0.1 s/vb.'
    },
    urlString: '/v1/fees/precise',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/precise`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 2.023,
  "halfHourFee": 1.094,
  "hourFee": 0.502,
  "economyFee": 0.2,
  "minimumFee": 0.1
}`
        },
      }
    }
  },
  {
    type: 'category',
    category: 'mempool',
    fragment: 'mempool',
    title: 'Mempool',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool',
    title: 'GET Mempool',
    description: {
      default: 'Returns current mempool backlog statistics.'
    },
    urlString: '/mempool',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempool = await mempool.getMempool();

        document.getElementById("result").textContent = JSON.stringify(getMempool, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempool = await mempool.getMempool();
  console.log(getMempool);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 3169,
  vsize: 1891542,
  total_fee: "20317481",
  fee_histogram: []
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-transaction-ids',
    title: 'GET Mempool Transaction IDs',
    description: {
      default: 'Get the full list of txids in the mempool as an array. The order of the txids is arbitrary and does not match nitod.'
    },
    urlString: '/mempool/txids',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool/txids`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempoolTxids = await mempool.getMempoolTxids();

        document.getElementById("result").textContent = JSON.stringify(getMempoolTxids, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempoolTxids = await mempool.getMempoolTxids();
  console.log(getMempoolTxids);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "94167cdbac9b75744eb2768d4318d09404dbf1cabd696c4823f5760d67c28399",
  "d5e23827707bef310a8827be01a666b42aaa74d5f669ba767eebad355e92f8d8",
  "9e9635d8f165ef8c0c5754ac971268ee96e934f921bf39ca898c85e4b366ac20",
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-recent',
    title: 'GET Mempool Recent',
    description: {
      default: 'Get a list of the last 10 transactions to enter the mempool. Each transaction object contains simplified overview data, with the following fields: <code>txid</code>, <code>fee</code>, <code>vsize</code>, and <code>value</code>.'
    },
    urlString: '/mempool/recent',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool/recent`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempoolRecent = await mempool.getMempoolRecent();

        document.getElementById("result").textContent = JSON.stringify(getMempoolRecent, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempoolRecent = await mempool.getMempoolRecent();
  console.log(getMempoolRecent);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "597bf60ec0ea6a3b9428a63dfe5ac1cb86d44e91ef1f91515d5629793f0c500a",
    fee: 18277,
    vsize: 2585,
    value: 4972029
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-rbf',
    title: 'GET Mempool RBF Transactions',
    description: {
      default: 'Returns the list of mempool transactions that are part of a RBF chain.'
    },
    urlString: '/v1/replacements',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/replacements`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [],
          response: `[
  {
    tx: {
      txid: "7915699e8be42c9ad1ab50424cf3063072d3c5ed42edc77e7a01d9051fa18e89",
      fee: 14983,
      vsize: 141.5,
      value: 343934,
      rate: 105.886925795053,
      rbf: true,
      fullRbf: false
    },
    time: 1703331467,
    fullRbf: false,
    replaces: [
      {
        tx: {
          txid: "90b863a727d4abf9838e8df221052e418d70baf996e2cea3211e8df4da1bb131",
          fee: 13664,
          vsize: 141.25,
          value: 345253,
          rate: 96.7362831858407,
          rbf: true
        },
        time: 1703331398,
        interval: 69,
        fullRbf: false,
        replaces: []
      }
    ]
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-fullrbf',
    title: 'GET Mempool Full RBF Transactions',
    description: {
      default: 'Returns the list of mempool transactions that are part of a Full-RBF chain.'
    },
    urlString: '/v1/fullrbf/replacements',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fullrbf/replacements`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [],
          response: `[
  {
    tx: {
      txid: "5302358d244c8e609154c9c1ec5d1ddf2000fcc209753530f423672c6cfdd8ff",
      fee: 24436,
      vsize: 297.75,
      value: 273418,
      rate: 82.0688497061293,
      rbf: false,
      fullRbf: true
    },
    time: 1703409882,
    fullRbf: true,
    replaces: [
      {
        tx: {
          txid: "597bf60ec0ea6a3b9428a63dfe5ac1cb86d44e91ef1f91515d5629793f0c500a",
          fee: 24138,
          vsize: 297.75,
          value: 273716,
          rate: 81.06801007556675,
          rbf: false
        },
        time: 1703409853,
        interval: 29,
        fullRbf: true,
        replaces: []
      }
    ]
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'category',
    category: 'transactions',
    fragment: 'transactions',
    title: 'Transactions',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-cpfp',
    title: 'GET Children Pay for Parent',
    description: {
      default: 'Returns the ancestors and the best descendant fees for a transaction.'
    },
    urlString: '/v1/cpfp',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/cpfp/%{1}`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const txid = 'txid';
        const feesCPFP = await fees.getCPFP({ txid });

        document.getElementById("result").textContent = JSON.stringify(feesCPFP, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const txid = 'txid';
  const feesCPFP = await fees.getCPFP({ txid });
  console.log(feesCPFP);
          `,
        },
        codeSampleMainnet: {
          esModule: ['txid'],
          commonJS: ['txid'],
          curl: ['txid'],
          response: ``
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction',
    title: 'GET Transaction',
    description: {
      default: 'Returns details about a transaction. Available fields: <code>txid</code>, <code>version</code>, <code>locktime</code>, <code>size</code>, <code>weight</code>, <code>fee</code>, <code>vin</code>, <code>vout</code>, and <code>status</code>.'
    },
    urlString: '/tx/:txid',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const tx = await transactions.getTx({ txid });

        document.getElementById("result").textContent = JSON.stringify(tx, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const tx = await transactions.getTx({ txid });
  console.log(tx);
          `,
        },
        codeSampleMainnet: {
          esModule: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          commonJS: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          curl: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          response: `{
  txid: "fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b",
  version: 1,
  locktime: 0,
  vin: [],
  vout: [],
  size: 884,
  weight: 3536,
  fee: 20000,
  status: {
    confirmed: true,
    block_height: 363348,
    block_hash: "00000000000005ab347f9640198cf10187ac2272494d74ed4b175d18e7f2fd0e",
    block_time: 1435754650
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-hex',
    title: 'GET Transaction Hex',
    description: {
      default: 'Returns a transaction serialized as hex.'
    },
    urlString: '/tx/:txid/hex',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/hex`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txHex = await transactions.getTxHex({ txid });

        document.getElementById("result").textContent = JSON.stringify(txHex, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txHex = await transactions.getTxHex({ txid });
  console.log(txHex);
          `,
        },
        codeSampleMainnet: {
          esModule: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          commonJS: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          curl: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          response: `010000000536a007284bd52ee826680a7f43536472f1bcce1e76cd76b826b88c5884eddf1f0c0000006b483045022100bcdf40fb3b5ebfa2c158ac8d1a41c03eb3dba4e180b00e81836bafd56d946efd022005cc40e35022b614275c1e485c409599667cbd41f6e5d78f421cb260a020a24f01210255ea3f53ce3ed1ad2c08dfc23b211b15b852afb819492a9a0f3f99e5747cb5f0ffffffffee08cb90c4e84dd7952b2cfad81ed3b088f5b...`
        },
      }
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-merkleblock-proof',
    title: 'GET Transaction Merkleblock Proof',
    description: {
      default: 'Returns a merkle inclusion proof for the transaction using <a href=\'https://github.com/NitoNetwork/Nito-core/blob/1d81bbd5f79d6b857c80420d5c81915ea326adff/src/merkleblock.h\'>nitod\'s merkleblock</a> format.'
    },
    urlString: '/tx/:txid/merkleblock-proof',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/merkleblock-proof`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });

        document.getElementById("result").textContent = JSON.stringify(txMerkleBlockProof, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });
  console.log(txMerkleBlockProof);
          `,
        },
        codeSampleMainnet: {
          esModule: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          commonJS: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          curl: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          response: `0300000058f6dd09ac5aea942c01d12e75b351e73f4304cc442741000000000000000000ef0c2fa8517414b742094a020da7eba891b47d660ef66f126ad01e5be99a2fd09ae093558e411618c14240df820700000ce4d15e17594f257b22d1ddf47d07b3b88779a8374fcd515ad883d79726c6027da6abfcbc1341a049b30277d3bf14e4663...`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-merkle-proof',
    title: 'GET Transaction Merkle Proof',
    description: {
      default: 'Returns a merkle inclusion proof for the transaction using <a href=\'https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-transaction-get-merkle\'>Electrum\'s blockchain.transaction.get_merkle format.'
    },
    urlString: '/tx/:txid/merkle-proof',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/merkle-proof`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txMerkleProof = await transactions.getTxMerkleProof({ txid });

        document.getElementById("result").textContent = JSON.stringify(txMerkleProof, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txMerkleProof = await transactions.getTxMerkleProof({ txid });
  console.log(txMerkleProof);
          `,
        },
        codeSampleMainnet: {
          esModule: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          commonJS: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          curl: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          response: `{
  block_height: 363348,
  merkle: [
    "5302358d244c8e609154c9c1ec5d1ddf2000fcc209753530f423672c6cfdd8ff",
    "a5fbc1f831a271f6150811cf79f7d7760f59e0176a9fcc99c3b714c2da30ec71",
    "9e9635d8f165ef8c0c5754ac971268ee96e934f921bf39ca898c85e4b366ac20",
    "06b9f35b85ec5e4816cd0fc4c5e73aee45822b024238a718f3c50c61234804f2",
    "d76483d1dcf6b316aaa69123dab933331d0ed1d4a1836849b610aa5818611938",
    "9046c7341be878bdcb9cc242c5f41434716133695ef17c3abc0a596910e55593",
    "d5e23827707bef310a8827be01a666b42aaa74d5f669ba767eebad355e92f8d8",
    "9046c7341be878bdcb9cc242c5f41434716133695ef17c3abc0a596910e55593",
    "9046c7341be878bdcb9cc242c5f41434716133695ef17c3abc0a596910e55593",
    "d76483d1dcf6b316aaa69123dab933331d0ed1d4a1836849b610aa5818611938",
    "d5e23827707bef310a8827be01a666b42aaa74d5f669ba767eebad355e92f8d8"
  ],
  pos: 1465
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-outspend',
    title: 'GET Transaction Outspend',
    description: {
      default: 'Returns the spending status of a transaction output. Available fields: <code>spent</code> (boolean), <code>txid</code> (optional), <code>vin</code> (optional), and <code>status</code> (optional, the status of the spending tx).'
    },
    urlString: '/tx/:txid/outspend/:vout',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/outspend/%{2}`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txOutspend = await transactions.getTxOutspend({
          txid,
          vout: %{2},
        });

        document.getElementById("result").textContent = JSON.stringify(txOutspend, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txOutspend = await transactions.getTxOutspend({
    txid,
    vout: %{2},
  });
  console.log(txOutspend);
          `,
        },
        codeSampleMainnet: {
          esModule: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b', '3'],
          commonJS: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b', '3'],
          curl: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b', '3'],
          response: `{
  spent: true,
  txid: "d76483d1dcf6b316aaa69123dab933331d0ed1d4a1836849b610aa5818611938",
  vin: 1,
  status: {
    confirmed: true,
    block_height: 363354,
    block_hash: "000000000000013bba11e67273bda2c6d760d2dcde4e8f7f4cee037ecad7782d",
    block_time: 1435758032
  }
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-outspends',
    title: 'GET Transaction Outspends',
    description: {
      default: 'Returns the spending status of all transaction outputs.'
    },
    urlString: '/tx/:txid/outspends',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/outspends`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txOutspends = await transactions.getTxOutspends({ txid });
        document.getElementById("result").textContent = JSON.stringify(txOutspends, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txOutspends = await transactions.getTxOutspends({ txid });

  console.log(txOutspends);
          `,
        },
        codeSampleMainnet: {
          esModule: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          commonJS: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          curl: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          response: `[
  {
    spent: true,
    txid: "a5fbc1f831a271f6150811cf79f7d7760f59e0176a9fcc99c3b714c2da30ec71",
    vin: 12,
    status: {
      confirmed: true,
      block_height: 363349,
      block_hash: "0000000000000365ffc3597388318be0010e24ad98513a885cbf766cdf134719",
      block_time: 1435754897
    }
  },
  ...
]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-raw',
    title: 'GET Transaction Raw',
    description: {
      default: 'Returns a transaction as binary data.'
    },
    urlString: '/tx/:txid/raw',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/raw`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txRaw = await transactions.getTxRaw({ txid });

        document.getElementById("result").textContent = JSON.stringify(txRaw, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txRaw = await transactions.getTxRaw({ txid });
  console.log(txRaw);
          `,
        },
        codeSampleMainnet: {
          esModule: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          commonJS: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          curl: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          response: ``
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-rbf-timeline',
    title: 'GET Transaction RBF Timeline',
    description: {
      default: 'Returns the RBF tree timeline of a transaction.'
    },
    urlString: 'v1/tx/:txId/rbf',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/tx/%{1}/rbf`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [`98b4f3c7eb5b92092ac0ef8a6da58a9c304a24e37529b488d85aa4db3f9b0bca`],
          response: `{
  replacements: {
    tx: {
      txid: "98b4f3c7eb5b92092ac0ef8a6da58a9c304a24e37529b488d85aa4db3f9b0bca",
      fee: 1668,
      vsize: 276.75,
      value: 14849,
      rate: 4.824207492795389,
      rbf: false,
      fullRbf: true
    },
    time: 1703240261,
    fullRbf: true,
    replaces: [
      {
        tx: {
          txid: "94167cdbac9b75744eb2768d4318d09404dbf1cabd696c4823f5760d67c28399",
          fee: 420,
          vsize: 208.25,
          value: 4856,
          rate: 2.0168067226890756,
          rbf: false
        },
        time: 1702870898,
        interval: 369363,
        fullRbf: true,
        replaces: []
      }
      ...
    ]
  },
  replaces: [
    "94167cdbac9b75744eb2768d4318d09404dbf1cabd696c4823f5760d67c28399",
    "a5fbc1f831a271f6150811cf79f7d7760f59e0176a9fcc99c3b714c2da30ec71"
  ]
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-status',
    title: 'GET Transaction Status',
    description: {
      default: 'Returns the confirmation status of a transaction. Available fields: <code>confirmed</code> (boolean), <code>block_height</code> (optional), and <code>block_hash</code> (optional).'
    },
    urlString: '/tx/:txid/status',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/status`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txStatus = await transactions.getTxStatus({ txid });

        document.getElementById("result").textContent = JSON.stringify(txStatus, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txStatus = await transactions.getTxStatus({ txid });
  console.log(txStatus);
          `,
        },
        codeSampleMainnet: {
          esModule: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          commonJS: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          curl: ['fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          response: `{
  confirmed: true,
  block_height: 363348,
  block_hash: "00000000000005ab347f9640198cf10187ac2272494d74ed4b175d18e7f2fd0e",
  block_time: 1435754650
}`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-times',
    title: 'GET Transaction Times',
    description: {
      default: 'Returns the timestamps when a list of unconfirmed transactions was initially observed in the mempool. If a transaction is not found in the mempool or has been mined, the timestamp will be <code>0</code>.'
    },
    urlString: '/v1/transaction-times',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/transaction-times?txId[]=%{1}&txId[]=%{2}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: ['98b4f3c7eb5b92092ac0ef8a6da58a9c304a24e37529b488d85aa4db3f9b0bca', 'fd457139c6e2548d219b5ae5f15ce1ad257c95ed4f5cd63ede071fa5edb75a3b'],
          response: `[1703082129,1702325558]`
        },
      }
    }
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'POST',
    fragment: 'post-transaction',
    title: 'POST Transaction',
    description: {
      default: 'Broadcast a raw transaction to the network. The transaction should be provided as hex in the request body. The <code>txid</code> will be returned on success.'
    },
    urlString: '/api/tx',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `%{1}" "[[hostname]][[baseNetworkUrl]]/api/tx`, //custom interpolation technique handled in replaceCurlPlaceholder()
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txHex = '%{1}';

        const txid = await transactions.postTx({ txHex });

        document.getElementById("result").textContent = JSON.stringify(txid, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txHex = '%{1}';

  const txid = await transactions.postTx({ txHex });
  console.log(txid);
          `,
        },
        codeSampleMainnet: {
          esModule: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          commonJS: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          curl: ['0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000'],
          response: ``
        },
      }
    }
  },
];

export const faqData = [
  {
    type: 'category',
    category: 'basics',
    fragment: 'basics',
    title: 'Basics',
    showConditions: bitcoinNetworks
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-mempool',
    title: 'What is a mempool?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-mempool-explorer',
    title: 'What is a mempool explorer?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-blockchain',
    title: 'What is a blockchain?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-block-explorer',
    title: 'What is a block explorer?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-mining',
    title: 'What is mining?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-are-mining-pools',
    title: 'What are mining pools?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-are-vb-wu',
    title: 'What are virtual bytes (vB) and weight units (WU)?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-svb',
    title: 'What is nitoshi/vB?',
  },
  {
    type: 'category',
    category: 'help',
    fragment: 'help-stuck-transaction',
    title: 'Help! My transaction is stuck',
  },
  {
    type: 'endpoint',
    category: 'help',
    showConditions: bitcoinNetworks,
    fragment: 'why-is-transaction-stuck-in-mempool',
    title: 'Why isn\'t my transaction confirming?',
  },
  {
    type: 'endpoint',
    category: 'help',
    showConditions: bitcoinNetworks,
    fragment: 'how-to-get-transaction-confirmed-quickly',
    title: 'How can I get my transaction confirmed more quickly?',
  },
  {
    type: 'endpoint',
    category: 'help',
    showConditions: bitcoinNetworks,
    fragment: 'how-prevent-stuck-transaction',
    title: 'How can I prevent a transaction from getting stuck in the future?',
  },
  {
    type: 'category',
    category: 'using',
    fragment: 'using-this-website',
    title: 'Using this website',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-transactions',
    title: 'How can I look up a transaction?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-addresses',
    title: 'How can I look up an address?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-blocks',
    title: 'How can I look up a block?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-fee-estimates',
    title: 'How can I look up fee estimates?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-historical-trends',
    title: 'How can I explore historical trends?',
  },
  {
    type: 'category',
    category: 'advanced',
    fragment: 'advanced',
    title: 'Advanced',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-full-mempool',
    title: 'What does it mean for the mempool to be "full"?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'how-big-is-mempool-used-by-nito-explorer',
    title: 'How big is the mempool used by Nito Mempool\'s Explorer?',
    options: { officialOnly: true },
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-memory-usage',
    title: 'What is memory usage?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-empty-blocks',
    title: 'Why are there empty blocks?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-block-timestamps-dont-always-increase',
    title: 'Why don\'t block timestamps always increase?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-dont-fee-ranges-match',
    title: 'Why doesn\'t the fee range shown for a block match the feerates of transactions within the block?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    options: { auditOnly: true },
    fragment: 'how-do-block-audits-work',
    title: 'How do block audits work?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    options: { auditOnly: true },
    fragment: 'what-is-block-health',
    title: 'What is block health?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'how-do-transaction-filters-work',
    title: 'How do transaction filters work?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-are-sigops',
    title: 'What are sigops?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-adjusted-vsize',
    title: 'What is adjusted vsize?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-do-the-projected-block-fee-ranges-overlap',
    title: 'Why do the projected block fee ranges overlap?',
  },
  {
    type: 'category',
    category: 'self-hosting',
    fragment: 'self-hosting',
    title: 'Self-Hosting',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'who-runs-this-website',
    title: 'Who runs this website?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'host-my-own-instance-raspberry-pi',
    title: 'How can I host my own instance on a Raspberry Pi?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'host-my-own-instance-server',
    title: 'How can I host a Nito Mempool\'s Explorer instance on my own server?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'install-mempool-with-docker',
    title: 'Can I install Nito Mempool\'s Explorer using Docker?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'address-lookup-issues',
    title: 'Why do I get an error for certain address lookups on my Nito Mempool\'s Explorer instance?',
  }
];

export const electrumApiDocsData = [
  {
    type: 'category',
    category: 'server',
    fragment: 'server-methods',
    title: 'Server Methods',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'server',
    fragment: 'server-version',
    title: 'server.version',
    description: {
      default: 'Returns the server version and protocol version.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"server.version","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": ["Nito ElectrumX", "1.4"]
}`
  },
  {
    type: 'endpoint',
    category: 'server',
    fragment: 'server-banner',
    title: 'server.banner',
    description: {
      default: 'Returns the server banner message.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"server.banner","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "Welcome to Nito ElectrumX"
}`
  },
  {
    type: 'endpoint',
    category: 'server',
    fragment: 'server-ping',
    title: 'server.ping',
    description: {
      default: 'A simple ping to check if the server is responsive.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"server.ping","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": null
}`
  },
  {
    type: 'category',
    category: 'blockchain',
    fragment: 'blockchain-methods',
    title: 'Blockchain Methods',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'block-header',
    title: 'blockchain.block.header',
    description: {
      default: 'Returns the block header at the specified height as a hex string.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.block.header","params":[500000]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "00606425631b7ffe31cdf82e77b0b7c4bd8627d391a4b067d2242574bd0400000000000071ec30dac214b7c399cc9f6a17e0590f76d7f779cf110815f671a231f8c1fba5cd66a6680197041a4c888266"
}`
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'block-headers',
    title: 'blockchain.block.headers',
    description: {
      default: 'Returns a concatenated chunk of block headers starting at the specified height.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.block.headers","params":[500000,3]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "count": 3,
    "hex": "00606425631b7ffe31cdf82e77b0b7c4bd8627...0060fa344023b775bd4f10553a4c1a08e9ad...",
    "max": 2016
  }
}`
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'headers-subscribe',
    title: 'blockchain.headers.subscribe',
    description: {
      default: 'Subscribes to receive notifications when a new block is found. Returns the latest block header.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.headers.subscribe","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "height": 802354,
    "hex": "00001020a91e8092f24d024d83076787c296a32e668fd9c08e4f8be1720000000000000020c51211d1f053dfe8edad9b98850064a62e380ba56464dae189886c4e164351aa43cd69fdca001a44c58091"
  }
}`
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'estimatefee',
    title: 'blockchain.estimatefee',
    description: {
      default: 'Returns the estimated transaction fee in NITO/kB for a transaction to be confirmed within a certain number of blocks.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.estimatefee","params":[6]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": 3.319e-05
}`
  },
  {
    type: 'endpoint',
    category: 'blockchain',
    fragment: 'relayfee',
    title: 'blockchain.relayfee',
    description: {
      default: 'Returns the minimum relay fee for low-priority transactions in NITO/kB.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.relayfee","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": 1e-05
}`
  },
  {
    type: 'category',
    category: 'scripthash',
    fragment: 'scripthash-methods',
    title: 'Script Hash Methods',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'scripthash-get-balance',
    title: 'blockchain.scripthash.get_balance',
    description: {
      default: 'Returns the confirmed and unconfirmed balance for a script hash.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.get_balance","params":["0e8ce59a80eb0b595f83f039d28ba85818dbe703f7837a702d3ba7df57218075"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "confirmed": 0,
    "unconfirmed": 0
  }
}`
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'scripthash-get-history',
    title: 'blockchain.scripthash.get_history',
    description: {
      default: 'Returns the confirmed and unconfirmed transaction history for a script hash.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.get_history","params":["0e8ce59a80eb0b595f83f039d28ba85818dbe703f7837a702d3ba7df57218075"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    {
      "height": 800000,
      "tx_hash": "94167cdbac9b75744eb2768d4318d09404dbf1cabd696c4823f5760d67c28399"
    },
    {
      "height": 800028,
      "tx_hash": "ea1b709c0560f8fb176ba27a9d103f011a47bff34385adab5446c0f56869a705"
    }
  ]
}`
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'scripthash-listunspent',
    title: 'blockchain.scripthash.listunspent',
    description: {
      default: 'Returns the list of unspent transaction outputs for a script hash.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.listunspent","params":["0e8ce59a80eb0b595f83f039d28ba85818dbe703f7837a702d3ba7df57218075"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": []
}`
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'scripthash-subscribe',
    title: 'blockchain.scripthash.subscribe',
    description: {
      default: 'Subscribes to notifications for a script hash. Returns the hash of the transaction history, or null if there is no history.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.subscribe","params":["0e8ce59a80eb0b595f83f039d28ba85818dbe703f7837a702d3ba7df57218075"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "463f5a7324ff0d7479d80137c173ca728f2b9549bb466757e440bfa87f64d615"
}`
  },
  {
    type: 'endpoint',
    category: 'scripthash',
    fragment: 'scripthash-unsubscribe',
    title: 'blockchain.scripthash.unsubscribe',
    description: {
      default: 'Unsubscribes from a previously subscribed script hash.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.scripthash.unsubscribe","params":["0e8ce59a80eb0b595f83f039d28ba85818dbe703f7837a702d3ba7df57218075"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": false
}`
  },
  {
    type: 'category',
    category: 'transactions',
    fragment: 'transaction-methods',
    title: 'Transaction Methods',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'transaction-broadcast',
    title: 'blockchain.transaction.broadcast',
    description: {
      default: 'Broadcasts a raw transaction to the network. Returns the transaction hash if successful.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.transaction.broadcast","params":["0100000001..."]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "a5fbc1f831a271f6150811cf79f7d7760f59e0176a9fcc99c3b714c2da30ec71"
}`
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'transaction-get',
    title: 'blockchain.transaction.get',
    description: {
      default: 'Returns the raw transaction hex for a given transaction hash.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.transaction.get","params":["a5fbc1f831a271f6150811cf79f7d7760f59e0176a9fcc99c3b714c2da30ec71"]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "010000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff210320a10704cd66a66800100000000004b307000000000a4d696e696e67636f726500000000020000000000000000266a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf90000c2eb0b0000001600141543c36f34e58dd2a5153d4991f45932e9f7fbad0120000000000000000000000000000000000000000000000000000000000000000000000000"
}`
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'transaction-get-merkle',
    title: 'blockchain.transaction.get_merkle',
    description: {
      default: 'Returns the merkle proof for a transaction in a block.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.transaction.get_merkle","params":["a5fbc1f831a271f6150811cf79f7d7760f59e0176a9fcc99c3b714c2da30ec71",500000]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "block_height": 500000,
    "merkle": [],
    "pos": 0
  }
}`
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'transaction-id-from-pos',
    title: 'blockchain.transaction.id_from_pos',
    description: {
      default: 'Returns the transaction hash at a given position in a block.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"blockchain.transaction.id_from_pos","params":[500000,0]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "a5fbc1f831a271f6150811cf79f7d7760f59e0176a9fcc99c3b714c2da30ec71"
}`
  },
  {
    type: 'category',
    category: 'mempool',
    fragment: 'mempool-methods',
    title: 'Mempool Methods',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'fee-histogram',
    title: 'mempool.get_fee_histogram',
    description: {
      default: 'Returns a fee histogram of the mempool. Each entry is [fee_rate, cumulative_vsize] where fee_rate is in nitoshi per virtual byte.'
    },
    showConditions: bitcoinNetworks,
    requestExample: '{"jsonrpc":"2.0","id":1,"method":"mempool.get_fee_histogram","params":[]}',
    responseExample: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": []
}`
  },
];
