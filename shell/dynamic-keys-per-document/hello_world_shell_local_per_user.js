/*
Simple demonstration using MongoDB Client-Side Field Level Encryption (local key version)
using json pointer for per-user/per-document dynamic key selection
This pattern might be useful for Right to Be Forgotten GDPR use case.
 
Note: FLE schemas with json pointer dynamic key IDs require randomized mode and automatic encryption
Decryption -- whether randomized or deterministic -- is always automatic, assuming the data key is available/cached.

If deterministic (searchable) mode is required, consider dynamic user key selection
at the app level via explicit encryption methods (versus automatic), e.g.:

db.people.insert({
   firstName: 'Alan',
     ...
   ssn: db.getMongo().encrypt( $userIdKey, "901-01-0002" , ENC_DETERM ),
   dob: db.getMongo().encrypt( $userIdKey, new Date('1912-06-23'), ENC_DETERM ))
  })
 
 
 Requires Enterprise 4.2+ shell (comes with built-in mongocryptd) and a MongoDB 4.2+ database
 Local, stand-alone, replica set cluster, or Atlas MongoDB will all work.
 To use this, just open Mongo shell, with this file, e.g.:

    mongo --nodb --shell hello_world_shell_local_per_user.js

*/

var demoDB = "demoFLE"
var keyVaultColl = "__keystore"  // nothing special about this key vault collection name, but make it stand out

const ENC_DETERM = 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
const ENC_RANDOM = 'AEAD_AES_256_CBC_HMAC_SHA_512-Random'

print("\n\nBeginning FLE demo... \n")

var env = {}
env.connStr   = "localhost"

// Don't use this keyString to protect anything that matters and DEFINITELY NOT IN PRODUCTION
// Generate value with command line: echo $(head -c 96 /dev/urandom | base64 | tr -d '\n')
env.keyString = "Bd3ab6v14VHyMXKTUSKB8QxDL2Wb70NcCEL3cmbfs28jY7wqZ2BEHKdBZnz64NTCYJboqmZpf+2cmXf9X7A7oTRNk25MTZq5/pZHc7bsM5TsdyH+fvzd826VQXLVKwsU";
var localDevMasterKey = { key: BinData( 0, env.keyString ) }

var clientSideFLEOptions = {
    kmsProviders : {  local : localDevMasterKey  } ,
    schemaMap: {},  // on first invocation prior to field key generation, this should be empty
    keyVaultNamespace: demoDB + "." + keyVaultColl
}

print("Setting up an FLE Mongo client session... \n")
var encryptedSession = new Mongo(env.connStr, clientSideFLEOptions);

// Non-interactive mongo shell script equivalent of "use demoFLE"
db = encryptedSession.getDB( demoDB )

// Wipe sandbox. Approximate Atlas equivalent of: db.dropDatabase()
print("Wiping FLE demo sandbox... \n\n")
db.getCollectionNames().forEach(function(c){db.getCollection(c).drop()});

var keyVault = encryptedSession.getKeyVault();

print("Creating user-specific data keys... \n\n")

printjson( keyVault.createKey("local", "", ["u0001"]) )
printjson( keyVault.createKey("local", "", ["u0002"]) )
printjson( keyVault.createKey("local", "", ["u0003"]) )

print("\nAttempting to retrieve field keys... \n")

var records = db.getCollection( keyVaultColl ).find().pretty()
while (records.hasNext()) {
   printjson(records.next());
}

print("\nSetting server-side json schema for automatic encryption on `people` collection... \n\n")

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
                  "algorithm": ENC_RANDOM,
                  "keyId": "/userid"
               }
            },
            "dob": {
               "encrypt": {
                  "bsonType": "date",
                  "algorithm": ENC_RANDOM,
                  "keyId": "/userid"
               }
            },
         }
      }
   }
})


print("Attempting to insert sample documents with automatic encryption using per-user keys... \n")
try {
 var res = null
 res = db.people.insert({
   firstName: 'Grace',
   lastName:  'Hopper',
   userid: 'u0001',
   ssn: '901-01-0001',
   dob: new Date('1989-12-13'),
   address: {
      street: '123 Main Street',
      city:   'Omaha',
      state:  'Nebraska',
      zip:    '90210'
   },
   contact: {
      mobile: '202-555-1234',
      email:  'grace@example.com',
   }
  })
} catch (err) {
   res = err
}
print("Result: " + res)

try {
 var res = null
 res = db.people.insert({
   firstName: 'Alan',
   lastName:  'Turing',
   userid: 'u0002',
   ssn: '901-01-0002',
   dob: new Date('1912-06-23'),
   address: {
      street: '456 Oak Lane',
      city:   'Cleveland',
      state:  'Ohio',
      zip:    '23210'
   },
   contact: {
      mobile: '202-123-1234',
      email:  'alan@example.net',
   }
 })
} catch (err) {
   res = err
}
print("Result: " + res + "\n\n")

print("Dumping decrypted documents from `people`...")
var records = db.people.find().pretty()
while (records.hasNext()) {
   printjson(records.next());
}

print("\nDeleting user data key for userid: `u0002`... \n\n")
res = db.getCollection('__keystore').deleteOne({"keyAltNames": ["u0002"]})
printjson(res)


print("\nEstablishing a new Mongo client session (to flush cached keys)... \n\n")
encryptedSession = new Mongo(env.connStr, clientSideFLEOptions);
db = encryptedSession.getDB( demoDB )

print("Dumping updated key vault...")
try {
   var r = db.getCollection( keyVaultColl ).find()
   while (r.hasNext()) {
      printjson(r.next());
   }
} catch (err) {
   print(err)
}


print("\nAttempting to fetch & decrypt document with userid key u0001...")
try {
   var r = db.people.find({"userid":"u0001"}).pretty()
   while (r.hasNext()) {
      printjson(r.next());
   }
} catch (err) {
   print(err)
}


print("\nAttempting to fetch & decrypt document with deleted userid key u0002 (should fail)...")

try {
   var r = db.people.find({"userid":"u0002"}).pretty()
   while (r.hasNext()) {
      printjson(r.next());
   }
} catch (err) {
   r = err
}
print(r)

print("\nDemo complete.\n\n")
quit()
