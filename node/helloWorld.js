// Simple Client-Side Field Level Encryption example for Node.js - Encrypted insert (Step 2)

// NOTE: This is UNSUPPORTED code.
// Canonical docs are here (see 2nd example): https://mongodb.github.io/node-mongodb-native/3.4/reference/client-side-encryption/#examples

// Requires createKey.js setup (Step 1)

// To install:
//  Make sure the mongocryptd binary is on a default path (from the Enterprise server package on MongoDB Downloads)
//  If it's not, you will encounter this: Error: connect ECONNREFUSED 127.0.0.1:27020

//  mkdir hello; cp createKeys.js hello ; cp helloWorld.js hello; cd hello
//  npm install mongodb mongodb-client-encryption --save

//  node helloWorld.js


'use strict';
const assert = require('assert');

const dbName                 = 'demoFLE';
const dataCollectionName     = 'people';
const keyVaultCollectionName = '__keystore';
const dataNamespace          = `${dbName}.${dataCollectionName}`;
const keyVaultNamespace      = `${dbName}.${keyVaultCollectionName}`;

const PRETTY_PRINT = 2;

const URL                    = 'mongodb://localhost';
// const URL                 = 'mongodb+srv://username:password@atlas-cluster-XXX.XXX.aws.mongodb.net';

// Only needed if using AWS KMS
// See: Quickstart Guide for IAM setup & generating a KMS master key
const AWS_ACCESS_KEY     = 'AKIxxxxx';
const AWS_SECRET_KEY     = 'xxxxxxxx';
const AWS_MASTER_KMS_ARN = 'arn:aws:kms:us-east-1:12345:key/abcde-abcd-1234-abcd-xxxx';

// Only needed if using local master key for testing, or wrapping a custom key/secrets REST service call
// See: Quickstart Guide for generating a local key in Base64 format
const LOCAL_MASTER_KEY   =  'CgOcoan3c/wm2c+WsOO6fXOUlJgd7SLQ1vl///aEFX6vXN9+7VOAP+iHKheZiYlB09ZS7CDcAQhlPeTeQNz03xiGbiCJJvl3uj4lnG+5i/udSLJAcwgtgtaedkFD0ROq';

const AEAD_DETERM = 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic';
const AEAD_RANDOM = 'AEAD_AES_256_CBC_HMAC_SHA_512-Random';

const mongodb = require('mongodb');
const { ClientEncryption } = require('mongodb-client-encryption');
const { MongoClient } = require('mongodb');

(async () => {

  console.log(`Connecting to "${URL}"...`);
  var client = new MongoClient(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await client.connect();
  console.log("\nConnected.\n");

  console.log("Fetching 'key1' Id (assumes createKeys.js was already run)... \n");

  var key1 =
  await client
    .db(dbName)
    .collection(keyVaultCollectionName)
    .findOne({ 'keyAltNames': 'key1' })
    .catch((err) => { console.error(err.stack) });

  console.log( key1._id );

  console.log("\nHex value for 'key1' _id: \n" + key1._id.toString('hex'));

  const peopleSchema = {
    [dataNamespace]: {
      bsonType: 'object',
      properties: {
        ssn: {
          encrypt: {
            bsonType: 'string',
            algorithm: AEAD_DETERM,
            keyId: [ key1._id  ]
          }
        },
        mobile: {
          encrypt: {
            bsonType: 'string',
            algorithm: AEAD_RANDOM,
            keyId: [ key1._id ]
          }
        }
      }
    }
  };

  // console.log("\npeopleSchema: ")
  // console.log( JSON.stringify(peopleSchema, null, PRETTY_PRINT) );

  console.log("\nClosing client connection...")
  await client.close();

  // NOTE: Instead of dynamically querying for key1 Id each connection, consider
  // saving fixed keyId Object IDs in json schema definition
  
  console.log("\nOpening encrypted client connection...")

  const kmsProviderLocal = {
    local: {
      key: Buffer.from(LOCAL_MASTER_KEY, "base64")
    }
  };

  const kmsProviderAWS = {
    aws: {
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET_KEY
    }
  };

  var client = new MongoClient(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    monitorCommands: true,
    autoEncryption: { keyVaultNamespace, kmsProviders: kmsProviderLocal, schemaMap: peopleSchema }
  });
  await client.connect();
  console.log('Connected.');

  console.log("\nDropping people collection if present...")

  await client
    .db(dbName)
    .collection(dataCollectionName)
    .drop()
    .catch(() => {});

 console.log("\nAttempting to insert a document using transparent encryption...");

 var doc = {
   firstName: 'Pat',
   lastName: 'Lee',
   medRecNum: 235498,
   ssn: '901-01-0001',
   mobile: '+1-212-555-1234',
   email: 'lee@example.com'
 };

await client
  .db(dbName)
  .collection(dataCollectionName)
  .insertOne(doc)
  .catch((err) => { console.error(err.stack) });

console.log("\nDocument inserted.");

console.log("\nFetching encrypted document... \n");

var doc =
await client
  .db(dbName)
  .collection(dataCollectionName)
  .findOne({ 'medRecNum' : 235498 })
  .catch((err) => { console.error(err.stack) });

console.log( doc );

console.log("\nClosing encrypted connection...\n")
await client.close();

console.log("\nTest complete. \n");


})().catch( err => console.error(err.stack) );

