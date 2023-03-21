/*
 Simple demonstration using MongoDB Client-Side Field Level Encryption/CSFLE
 Config file shows local or KMS key connect to a local DB, self-managed, or Atlas cluster
 Requires Community or (preferrably) Enterprise 4.2+ database
 Local, stand-alone, or Atlas MongoDB will all work.
 To use this, open (reasonbly current) mongosh shell, with this file, e.g.:

    mongosh --nodb --shell <thisFile.js>

 Note, you will need the `localkey_config.env` file from this repo.
*/

var demoDB = "demoFLE"
var vaultDB = "vault"
var keyVaultColl = "__keystore"  // nothing special about this key vault collection name, but make it stand out

const ENC_DETERM = 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
const ENC_RANDOM = 'AEAD_AES_256_CBC_HMAC_SHA_512-Random'

var env = {}
print("\nLoading local key configuration file...")
try {
   load( 'localkey_config.js' );
} catch (err) {
   print("Exiting: Unable to open local config file." );
   quit()
}

if (env.keyString == "PASTE GENERATED KEY STRING HERE"){
   print("\nPlease generate a new local key (see `localkey_config.env` file). Exiting. \n\n"); quit();
} 

var localDevMasterKey = { key: BinData( 0, env.keyString ) }

var clientSideFLEOptions = {
    kmsProviders : {  local : localDevMasterKey  } ,
    schemaMap: {},  // on first invocation prior to field key generation, this should be empty
    keyVaultNamespace: vaultDB + "." + keyVaultColl
};

encryptedSession = new Mongo(env.connStr, clientSideFLEOptions);

// javascript shell script equivalent of: use demoFLE
db = encryptedSession.getDB( demoDB )

// Wipe sandbox. Approximate Atlas equivalent of: db.dropDatabase()
db.getCollectionNames().forEach(function(c){db.getCollection(c).drop()});

var keyVault = encryptedSession.getKeyVault();

print("Attempting to create field keys...")
var key1 = keyVault.createKey("local", "", ["fieldKey1"])
var key2 = keyVault.createKey("local", "", ["fieldKey2"])

/*
If you need to access keys in a different session, use mongosh-specific helper method: getKeyByAltName
print("Attempting to retrieve field keys...")
var key1 = keyVault.getKeyByAltName("fieldKey1")._id
var key2 = keyVault.getKeyByAltName("fieldKey2")._id
*/

print("key1: "); printjson(key1.toString())
print("key2: "); printjson(key2.toString())


print("\nSetting server-side json schema for automatic encryption on `people` collection...")
db.createCollection("people")
db.runCommand({
   collMod: "people",
   validator: {
      $jsonSchema: {
         "bsonType": "object",
         "properties": {
            "ssn": {
               "encrypt": {
                  "bsonType": "string",
                  "algorithm": ENC_DETERM,
                  "keyId": [ key1 ]
               }
            },
            "dob": {
               "encrypt": {
                  "bsonType": "date",
                  "algorithm": ENC_RANDOM,
                  "keyId": [ key1 ]
               }
            },
         }
      }
   }
})

print("Creating client-side json schema config for automatic encryption on `people` collection...")
var peopleSchema = {
   "demoFLE.people": {
      "bsonType": "object",
      "properties": {
         "ssn": {
            "encrypt": {
               "bsonType": "string",
               "algorithm": ENC_DETERM,
               "keyId": [ key1 ]
            }
         },
         "dob": {
            "encrypt": {
               "bsonType": "date",
               "algorithm": ENC_RANDOM,
               "keyId": [ key1 ]
            }
         },
         "contact": {
            "bsonType": "object",
            "properties": {
               "email": {
                  "encrypt": {
                     "bsonType": "string",
                     "algorithm": ENC_DETERM,
                     "keyId": [ key2 ]
                  }
               },
               "mobile": {
                  "encrypt": {
                     "bsonType": "string",
                     "algorithm": ENC_DETERM,
                     "keyId": [ key2 ]
                  }
               }
            },
         },
      }
   }
}


print("Updating FLE mode session to enable server- and client-side json schema for automatic encryption...")

var clientSideFLEOptions = {
   kmsProviders: { local: localDevMasterKey },
   schemaMap: peopleSchema,
   keyVaultNamespace: vaultDB + "." + keyVaultColl
}
var encryptedSession = new Mongo(env.connStr, clientSideFLEOptions)
var db = encryptedSession.getDB( demoDB );
var clientEncryption = encryptedSession.getClientEncryption()

print("Attempting to detect server-side Enterprise edition mode...")
var edition = db.runCommand({buildInfo:1}).modules
var enterprise = false
if ( edition !== undefined && edition.length != 0 ){
   var enterprise = true
}
print("MongoDB server running in enterprise mode: " + enterprise + "\n")

print("Attempting to insert sample document with automatic encryption...")
try {
 var res = null
 res = db.people.insertOne({
   firstName: 'Grace',
   lastName:  'Hopper',
   ssn: "901-01-0001",
   dob: new Date('1989-12-13'),
   address: {
      street: '123 Main Street',
      city:   'Omaha',
      state:  'Nebraska',
      zip:    '90210'
   },
   contact: {
      mobile: '202-555-1212',
      email:  'grace@example.com',
   }
  })
} catch (err) {
   res = err
}
print("Result: " + res)

print("Attempting to insert sample document with explicit encryption in automatic mode (will fail)...")
try{
  var res = null
  res = db.people.insertOne({
   firstName: 'Alan',
   lastName:  'Turing',
   ssn: clientEncryption.encrypt( key1 , "901-01-0002" , ENC_DETERM ),
   dob: clientEncryption.encrypt( key1 , new Date('1912-06-23'), ENC_RANDOM ),
   address: {
      street: '123 Oak Lane',
      city:   'Cleveland',
      state:  'Ohio',
      zip:    '90210'
   },
   contact: {
      mobile: clientEncryption.encrypt( key2 , '202-555-1234', ENC_DETERM ),
      email:  clientEncryption.encrypt( key2 , 'alan@example.net', ENC_DETERM ),
   }
 })
} catch (err) {
   res = err
}
print("Result: " + res)

print("\nEnabling session bypass on automatic encrypt (autodecrypt is always on, even in explicit mode)... \n")

var clientSideFLEOptions = {
   "kmsProviders": { "local": localDevMasterKey },
   bypassAutoEncryption: true,
   schemaMap: peopleSchema,
   keyVaultNamespace: vaultDB + "." + keyVaultColl
}
var encryptedSession = new Mongo(env.connStr, clientSideFLEOptions)
var db = encryptedSession.getDB( demoDB );
var clientEncryption = encryptedSession.getClientEncryption()
print("Attempting to insert sample document with explicit encryption in bypass mode (should succeed)...")

try{
  var res = null
  res = db.people.insertOne({
   firstName: 'Alan',
   lastName:  'Turing',
   ssn: clientEncryption.encrypt( key1 , "901-01-0002" , ENC_DETERM ),
   dob: clientEncryption.encrypt( key1 , new Date('1912-06-23'), ENC_RANDOM ),
   address: {
      street: '123 Oak Lane',
      city:   'Cleveland',
      state:  'Ohio',
      zip:    '90210'
   },
   contact: {
      mobile: clientEncryption.encrypt( key2 , '202-555-1234', ENC_DETERM ),
      email:  clientEncryption.encrypt( key2 , 'alan@example.net', ENC_DETERM ),
   }
 })
} catch (err) {
   res = err
}
print("Result: " + res)

print("Dumping (raw) records from `people`:")
var records = db.people.find().pretty()
while (records.hasNext()) {
   printjson(records.next());
}

print("\nDisabling session bypass for automatic encrypt...\n")
var clientSideFLEOptions = {
   kmsProviders: { local: localDevMasterKey },
   schemaMap: peopleSchema,
   keyVaultNamespace: vaultDB + "." + keyVaultColl
}
var encryptedSession = new Mongo(env.connStr, clientSideFLEOptions)
var db = encryptedSession.getDB( demoDB );

print("Dumping (automatic decrypted) records from `people`:")
var records = db.people.find().pretty()
while (records.hasNext()) {
   printjson(records.next());
}

print("\nEstablishing convention/non-encrypted session...\n")
var plaintextSession = new Mongo(env.connStr) // Note: No clientSideFLEOptions specified
var db = plaintextSession.getDB( demoDB );

print("Dumping raw records from `people`:")
var records = db.people.find().pretty()
while (records.hasNext()) {
   printjson(records.next());
}


print("\nDemo complete.")
