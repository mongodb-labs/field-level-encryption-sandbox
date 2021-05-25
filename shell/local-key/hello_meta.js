/*
 Simple demonstration using MongoDB Client-Side Field Level Encryption (local key version)
 Requires Enterprise 4.2.2+ shell and a MongoDB 4.2+ Enterprise or Atlas database
 Local, stand-alone, or Atlas DB will all work.

 This example demonstrates use of the "encryptMeta" keyword to default to a given
 key (note: this can be combined with the json pointer keyId operator as well)
 without having to repeat the directive. We also illustrate "patternProperties" to 
 force all subdocument fields (via a wildcard) in "contacts" to all use field level encryption.
 Useful when the field names are unknown, or dynamic (e.g., certain ones sometimes present, sometimes not)

 To use this, run Mongo shell, with this file, e.g.:

    mongo --nodb --shell hello_meta.js

 Note, you will need the attached `localkey_config.env` file from this repo.
*/

var demoDB = "demoFLE"
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
   print("\nPlease generate a new local key (see `localkey_config.js` file). Exiting. \n\n"); quit();
} 

var localDevMasterKey = { key: BinData( 0, env.keyString ) }

var clientSideFLEOptions = {
    kmsProviders : {  local : localDevMasterKey  } ,
    schemaMap: {},  // on first invocation prior to field key generation, this should be empty
    keyVaultNamespace: demoDB + "." + keyVaultColl
};

encryptedSession = new Mongo(env.connStr, clientSideFLEOptions);

// javascript shell script equivalent of: use demoFLE
db = encryptedSession.getDB( demoDB )

// Wipe sandbox. Approximate Atlas equivalent of: db.dropDatabase()
db.getCollectionNames().forEach(function(c){db.getCollection(c).drop()});

var keyVault = encryptedSession.getKeyVault();

print("Attempting to create field keys...")
keyVault.createKey("local", "", ["fieldKey1"])
keyVault.createKey("local", "", ["fieldKey2"])

print("Attempting to retrieve field keys...")
var key1 = db.getCollection( keyVaultColl ).find({ keyAltNames: 'fieldKey1' }).toArray()[0]._id
var key2 = db.getCollection( keyVaultColl ).find({ keyAltNames: 'fieldKey2' }).toArray()[0]._id

print("Creating client-side json schema config for automatic encryption on `people` collection...")
var peopleSchema = {
    "demoFLE.people": {
       "bsonType": "object",
       "encryptMetadata": {
          "keyId": [ key1 ]
        },
       "properties": {

         "ssn": {
            "encrypt": {
               "bsonType": "string",
               "algorithm": ENC_DETERM,
            }
         },
         "dob": {
            "encrypt": {
               "bsonType": "date",
               "algorithm": ENC_RANDOM,
            }
         },
         "contacts": {
            "bsonType": "object",
            "patternProperties": {
               ".*": {
                  "encrypt": {
                     "bsonType": "string",
                     "algorithm": ENC_DETERM,
                   }
               }
            }
         }
      }
   }
}


print("Updating FLE mode session to enable server- and client-side json schema for automatic encryption...")

var clientSideFLEOptions = {
   kmsProviders: { local: localDevMasterKey },
   schemaMap: peopleSchema,
   keyVaultNamespace: demoDB + "." + keyVaultColl
}
var encryptedSession = new Mongo(env.connStr, clientSideFLEOptions)
var db = encryptedSession.getDB( demoDB );

print("Attempting to detect server-side Enterprise edition mode...")
var edition = db.runCommand({buildInfo:1}).modules
var enterprise = false
if ( edition !== undefined && edition.length != 0 ){
   var enterprise = true
}
print("MongoDB server running in enterprise mode: " + enterprise + "\n")

print("Attempting to insert sample documents with automatic encryption...")
try {
 var res = null
 res = db.people.insert({
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
   contacts: {
      mobile: '202-555-1212',
      email:  'grace@example.com',
      twitter: '@digitalOG',
   }
 })
} catch (err) {
   res = err
}
print("Result: " + res)

try{
  var res = null
  res = db.people.insert({
   firstName: 'Alan',
   lastName:  'Turing',
   ssn: "901-01-0002",
   dob: new Date('1912-06-23'),
   address: {
      street: '123 Oak Lane',
      city:   'Cleveland',
      state:  'Ohio',
      zip:    '90210'
   },
   contacts: {
      mobile: '202-555-1234',
      email:  'alan@example.net',
      twitter: '@codebrkr1',
   }
 })
} catch (err) {
   res = err
}
print("Result: " + res)

try{
  var res = null
  res = db.people.insert({
   firstName: 'Ada',
   lastName:  'Lovelace',
   ssn: "901-01-0003",
   dob: new Date('1815-12-05'),
   address: {
      street: '3 Ogle St',
      city:   'Hucknall',
      state:  'Nottingham',
      zip:    'NG15 7FQ'
   },
   contacts: {
      mobile: '+44 115 964 1499',
      email:  'ada@example.net',
      twitter: '@NoteG',
      agent: 'Chuck Babbage'
   }
 })
} catch (err) {
   res = err
}
print("Result: " + res)


print("Dumping (automatic decrypted) records from `people`:")
var records = db.people.find().pretty()
while (records.hasNext()) {
   printjson(records.next());
}

print("Doing subdocument search for `contacts.mobile` matching `202-555-1212`:")
var records = db.people.find({'contacts.mobile':'202-555-1212'}).pretty()
while (records.hasNext()) {
   printjson(records.next());
}


print("\nDemo complete.")
