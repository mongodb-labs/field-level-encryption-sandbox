// Simple Client-Side Field Level Encryption example for Node.js - Key setup (Step 1)

// NOTE: This is UNSUPPORTED code.
// Canonical docs are here (see 2nd example): https://mongodb.github.io/node-mongodb-native/3.4/reference/client-side-encryption/#examples

// To install:
//  Make sure the mongocryptd binary is on a default path (from the Enterprise server package on MongoDB Downloads)
//  Or running: cd /tmp ; mongocryptd 2>&1 >mongocryptd.log & 
//  If it's not, you will encounter this: Error: connect ECONNREFUSED 127.0.0.1:27020
//
//  mkdir proj; cp hello_fle_node.js proj; cd proj
//  npm install mongodb mongodb-client-encryption
//  node createKeys.js

'use strict';

const assert = require('assert');
const mongodb = require('mongodb');
const { ClientEncryption } = require('mongodb-client-encryption');
const { MongoClient } = mongodb;

const dbName                 = 'demoFLE';
const dataCollection         = 'people';
const keyVaultCollectionName = '__keystore';
const keyVaultNamespace      = `${dbName}.${keyVaultCollectionName}`;
const URL                    = 'mongodb://localhost';
// const URL                 = 'mongodb+srv://username:password@atlas-cluster-XXX.XXX.aws.mongodb.net';

// Only needed if using AWS KMS
// See: Quickstart Guide for IAM setup & generating a KMS master key
const AWS_ACCESS_KEY     = 'AKIxxxxx';
const AWS_SECRET_KEY     = 'xxxxxxxx';
const AWS_MASTER_KMS_ARN = 'arn:aws:kms:us-east-1:12345:key/abcde-abcd-1234-abcd-xxxx';

// Only needed if using local master key for testing, or wrapping a custom key/secrets REST service call
// See: Quickstart Guide for generating a local key in Base64 format
// Test key material generated on Mac & Linux with: echo $(head -c 96 /dev/urandom | base64 | tr -d '\n')

// ** A LOCAL TEST KEY SHOULD NEVER BE USED IN PRODUCTION, ONLY FOR DEVELOPMENT **

const LOCAL_MASTER_KEY   =  'CgOcoan3c/wm2c+WsOO6fXOUlJgd7SLQ1vl///aEFX6vXN9+7VOAP+iHKheZiYlB09ZS7CDcAQhlPeTeQNz03xiGbiCJJvl3uj4lnG+5i/udSLJAcwgtgtaedkFD0ROq';

const AEAD_DETERM = 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic';
const AEAD_RANDOM = 'AEAD_AES_256_CBC_HMAC_SHA_512-Random';

(async () => {

  console.log(`Connecting to "${URL}"...`);
  const client = new MongoClient(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await client.connect();
  console.log('Connected.');

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

  const encryption = new ClientEncryption(client, {
    keyVaultNamespace,
    kmsProviders: kmsProviderLocal
  });

  const keyVaultCollection = client.db(dbName).collection(keyVaultCollectionName);

  console.log("\nDropping keyVaultCollection if present...")

  await client
    .db(dbName)
    .collection(keyVaultCollectionName)
    .drop()
    .catch(() => {});

  console.log("\nCreating data keys...");

  const key1 =
  await encryption
    .createDataKey('local', { keyAltNames: ['key1'] })
    .catch((err) => { console.error(err.stack) });

  console.log("Data key created. 'key1' keyId/UUID:");
  console.log({ key1 });

  console.log("\nQuerying 'key1'...")

  await client
    .db(dbName)
    .collection(keyVaultCollectionName)
    .findOne({ 'keyAltNames': 'key1' }, function(err, key) {

      // console.log(key);
      console.log("\nHex value for 'key1' _id: \n" + key._id.toString('hex'));
    });

     await client.close();
     console.log("\nSetup complete. \n");

})().catch( err => console.error(err.stack) );
