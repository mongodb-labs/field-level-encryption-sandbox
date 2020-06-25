The following snippets are simple examples of how to consume a master key that's protected by secure key manager or secrets manager via a REST service call to something like GCP KMS, Azure Vault, or Hashicorp Vault

For more advanced examples of data schemas, see:  
https://github.com/mongodb-labs/field-level-encryption-sandbox/  
Especially: https://github.com/mongodb-labs/field-level-encryption-sandbox/blob/master/shell/local-key/hello_world_shell_local.js 

Below, we will generate key material for a master key generated on Mac & Linux via:  
```bash
echo $(head -c 96 /dev/urandom | base64 | tr -d '\n')
```


Prerequisites (from terminal; see Sandbox language-specific examples linked above for generating master keys inline)

```bash

# To encrypt the data with gcloud kms encrypt, provide your key information, generate
# Master Key key material, and specify the name of the file that will contain the encrypted content

# https://cloud.google.com/kms/docs/quickstart#encrypt_data

# Create and pipe Master Key Encryption Key key material into gcloud process for simple envelope wrap

echo $(head -c 96 /dev/urandom | base64 | tr -d '\n') | \
  gcloud kms encrypt \
    --location "global" \
    --keyring "test" \
    --key "quickstart" \
    --plaintext-file - \
    --ciphertext-file file-path-for-encrypted-master-key 
```
Now, with a Master Key created and protected, provide that to FLE code
```bash

# One option - inject decrypted master key into process environment
# https://cloud.google.com/kms/docs/encrypt-decrypt

MASTER_KEY=$(gcloud kms decrypt \
    --key key \
    --keyring key-ring \
    --location key-ring-location  \
    --ciphertext-file file-path-to-encrypted-master-key \
    --plaintext-file - )

 # $MASTER_KEY can now be consumed from environment with one line of application glue code

```
```javascript
// E.g., for Javascript/Node:
// See https://github.com/mongodb-labs/field-level-encryption-sandbox/blob/master/node/helloWorld.js

...
const LOCAL_MASTER_KEY = process.env.MASTER_KEY
...

```


Alternatively, use native SDK to bring in master key inline
```javascript
// E.g., for Javascript/Node:

// https://github.com/googleapis/nodejs-kms/blob/master/samples/decryptSymmetric.js

...

// Import the Cloud KMS library
const {KeyManagementServiceClient} = require('@google-cloud/kms');

// Instantiate a client
const client = new KeyManagementServiceClient();
...

masterKey = decryptSymmetric()

// See https://github.com/mongodb-labs/field-level-encryption-sandbox/blob/master/node/helloWorld.js
// In this example, "masterKey" would replace hard-coded "LOCAL_MASTER_KEY" from the Sandbox Node example

...

```
