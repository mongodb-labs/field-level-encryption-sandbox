/*
 Simple demonstration using MongoDB Client-Side Field Level Encryption (local key version)
 with Explicit Encryption including encrypted arrays
 
 Community edition shell v 4.2.2 shell higher and a MongoDB 4.2+ database are required
 
 Local, stand-alone, or Atlas MongoDB will all work.
 To use this, just open Mongo shell, with this file, e.g.:

    mongo --nodb hello_explicit.js

 Note, you will need the attached `localkey_config.js` file from this repo.
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
    keyVaultNamespace: demoDB + "." + keyVaultColl,
    bypassAutoEncryption : true		// force explicit encryption

};

encryptedSession = new Mongo(env.connStr, clientSideFLEOptions);

// javascript shell script equivalent of: use demoFLE
db = encryptedSession.getDB( demoDB )

// Wipe sandbox. Approximate Atlas equivalent of: db.dropDatabase()
db.getCollectionNames().forEach(function(c){db.getCollection(c).drop()});

var keyVault = encryptedSession.getKeyVault();

print("Attempting to create field keys...")
keyVault.createKey("local", "", ["fieldKey1"])

print("Attempting to retrieve field keys...")

var key1 = db.getCollection( keyVaultColl ).find({ keyAltNames: 'fieldKey1' }).toArray()[0]._id

var db = encryptedSession.getDB( demoDB );

print("Attempting to insert sample document 1 with explicit encryption...")

try{
  var res = null
  res = db.people.insert({

   firstName: 'Grace',
   lastName:  'Hopper',
   ssn: db.getMongo().encrypt( key1 , "901-01-0001" , ENC_DETERM ),
   dob: db.getMongo().encrypt( key1 , new Date('11989-12-13'), ENC_RANDOM ),
   address: {
      street: '123 Main Street',
      city:   'Omaha',
      state:  'Nebraska',
      zip:    '90210'
   },
   contact: {
      mobile: db.getMongo().encrypt( key1 , '202-555-1212', ENC_DETERM ),
      email:  db.getMongo().encrypt( key1 , 'grace@example.com', ENC_DETERM ),
   },
   tags: [
      db.getMongo().encrypt( key1, "American", ENC_DETERM),
      db.getMongo().encrypt( key1, "pioneer", ENC_DETERM),
      db.getMongo().encrypt( key1, "Univac", ENC_DETERM)
   ]
 })
} catch (err) {
   res = err
}
print("Result: " + res)

print("Attempting to insert sample document 2 with explicit encryption...")

try{
  var res = null
  res = db.people.insert({
   firstName: 'Alan',
   lastName:  'Turing',
   ssn: db.getMongo().encrypt( key1 , "901-01-0002" , ENC_DETERM ),
   dob: db.getMongo().encrypt( key1 , new Date('1912-06-23'), ENC_RANDOM ),
   address: {
      street: '123 Oak Lane',
      city:   'Cleveland',
      state:  'Ohio',
      zip:    '90210'
   },
   contact: {
      mobile: db.getMongo().encrypt( key1 , '202-555-1234', ENC_DETERM ),
      email:  db.getMongo().encrypt( key1 , 'alan@example.net', ENC_DETERM ),
   },
   tags: [
      db.getMongo().encrypt( key1, "British", ENC_DETERM),
      db.getMongo().encrypt( key1, "pioneer", ENC_DETERM),
      db.getMongo().encrypt( key1, "encryption", ENC_DETERM),
      db.getMongo().encrypt( key1, "Engigma", ENC_DETERM)
   ]

 })
} catch (err) {
   res = err
}
print("Result: " + res)

print("Dumping all (automatic decrypted) records from `people`:")

var records = db.people.find().pretty()
while (records.hasNext()) {
   printjson(records.next());
}

print("Attempting to search for encrypted array element `tag` containing `pioneer`")

var records = db.people.find(
   { tags: { $all: [ db.getMongo().encrypt( key1, "pioneer", ENC_DETERM) ] } }
).pretty()
while (records.hasNext()) {
   printjson(records.next());
}

var classicSession = new Mongo(env.connStr)
var db = classicSession.getDB( demoDB );

print("Dumping all (raw) records from `people`:")

var records = db.people.find().pretty()
while (records.hasNext()) {
   printjson(records.next());
}

print("\nDemo complete.")
