#  Simple hello world for MongoDB client-side field level encryption using Python
#
#  Python installer requires PIP v 19+ (pip --version)
#    sudo apt remove python-pip
#    sudo apt remove python3-pip
#    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py && sudo python get-pip.py && sudo python3 get-pip.py
#
#  Assumes a local mongod 4.2 DB is running on 27017, and mongocryptd is running on 27020
#
#  python -m pip install pymongo
#  python -m pip install pymongocrypt
#
#  Ensure this works: python -c "import pymongocrypt; print(pymongocrypt.libmongocrypt_version())"
#
#  If mongocryptd is not running: "pymongo.errors.EncryptionError: localhost:27020: [Errno 111] Connection refused"

import base64
import pymongo
from pymongo import MongoClient
from pymongo.encryption_options import AutoEncryptionOpts
import pymongocrypt;
from bson import binary
from bson.binary import (Binary,
                         JAVA_LEGACY,
                         STANDARD,
                          UUID_SUBTYPE)
from bson.codec_options import CodecOptions
OPTS = CodecOptions(uuid_representation=STANDARD)

print(pymongocrypt.libmongocrypt_version())

client = MongoClient( "localhost", 27017 )

# ** A LOCAL TEST KEY SHOULD NEVER BE USED IN PRODUCTION, ONLY FOR DEVELOPMENT **

# Test key material generated on Mac & Linux with: echo $(head -c 96 /dev/urandom | base64 | tr -d '\n')
local_key = 'CgOcoan3c/wm2c+WsOO6fXOUlJgd7SLQ1vl///aEFX6vXN9+7VOAP+iHKheZiYlB09ZS7CDcAQhlPeTeQNz03xiGbiCJJvl3uj4lnG+5i/udSLJAcwgtgtaedkFD0ROq'
key_bin   = binary.Binary( base64.b64decode( local_key ) )
kms_providers = { 'local': {'key': key_bin } }

print("Please ensure mongocryptd is running (included in the standard enterprise download package).")
      
fle_opts = AutoEncryptionOpts( kms_providers , "demoFLE.__keystore", mongocryptd_bypass_spawn = True )

client = MongoClient( "mongodb://localhost:27017/demoFLE", auto_encryption_opts = fle_opts )

db = client.demoFLE

client_encryption = pymongo.encryption.ClientEncryption(kms_providers, "demoFLE.__keystore", client, OPTS )
client_encryption.create_data_key('local', key_alt_names=['pykey1'])

key1 = db.get_collection('__keystore').find_one({ "keyAltNames": "pykey1" })['_id']

client.close()

# Re-connect with auto-encryption schema map

peopleSchema = {
   "demoFLE.people": {
     "bsonType": "object",
     "properties": {
       "ssn": {
         "encrypt": {
           "bsonType": "string",
           "algorithm": "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
           "keyId": [ key1 ] 
         }
       },
     }
   }
}

fle_opts = AutoEncryptionOpts( kms_providers , "demoFLE.__keystore", schema_map = peopleSchema, mongocryptd_bypass_spawn = True )
client = MongoClient( "mongodb://localhost:27017/", auto_encryption_opts = fle_opts )

client.demoFLE.people.insert_one({'ssn': '123-12-1234'})

print( "Encrypted find() results: " )
print( client.demoFLE.people.find_one() )

client.close()
