# Client-side field level encryption in C# .NET Core on Linux (Debian, Ubuntu, RH, etc)

Note: This is _entirely_ unsupported example for development evaluation only.

## Prerequisite

Start mongocryptd (from enterprise server package download) as a background service (run `killall mongocryptd` top stop):

`cd /tmp && mongocryptd 2>&1 > /dev/null &`

## Prep package repos & install .NET Core packages

From the .NET Core 2.2 [SDK Linux install docs](https://dotnet.microsoft.com/download/linux-package-manager/sdk-2.2.103)

```bash
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.asc.gpg
sudo mv microsoft.asc.gpg /etc/apt/trusted.gpg.d/
# See also, e.g.: https://packages.microsoft.com/config/ubuntu/18.10/prod.list
wget -q https://packages.microsoft.com/config/debian/9/prod.list
sudo mv prod.list /etc/apt/sources.list.d/microsoft-prod.list
sudo chown root:root /etc/apt/trusted.gpg.d/microsoft.asc.gpg
sudo chown root:root /etc/apt/sources.list.d/microsoft-prod.list
```

## Install binaries

```bash
sudo apt-get update
sudo apt-get install apt-transport-https
sudo apt-get update
sudo apt-get install dotnet-sdk-2.2=2.2.103-1
```

## Create project from command line

```bash
mkdir csfle
cd csfle
dotnet new console -n csFLEExample
cd csFLEExample

dotnet add package MongoDB.Driver --version 2.10.0-beta1
dotnet add package MongoDB.Driver.Core --version 2.10.0-beta1
dotnet add package MongoDB.Bson --version 2.10.0-beta1
dotnet add package MongoDB.Libmongocrypt --version 1.0.0-beta01

vi Program.cs
```

Replace the default hello world `Program.cs` with the following code (slightly modified version of the example
code [example](http://mongodb.github.io/mongo-csharp-driver/2.10/reference/driver/crud/client_side_encryption/) in the C# CSFLE tutorial):

```csharp 
using MongoDB.Driver.Core.Misc;
using System;
using System.Collections.Generic;
using System.Threading;
using MongoDB.Bson;
using MongoDB.Driver.Encryption;

namespace MongoDB.Driver.Examples
{
    public class ClientEncryptionExamples
    {
        // Generate the local master key key via: echo $(head -c 96 /dev/urandom | base64 | tr -d '\n')
        
        private const string LocalMasterKey = "Mng0NCt4ZHVUYUJCa1kxNkVyNUR1QURhZ2h2UzR2d2RrZzh0cFBwM3R6NmdWMDFBMUN3YkQ5aXRRMkhGRGdQV09wOGVNYUMxT2k3NjZKelhaQmRCZGJkTXVyZG9uSjFk";

        // public void ClientSideEncryptionAutoEncryptionSettingsTour()
        public static void Main(string[] args)
        {
            var localMasterKey = Convert.FromBase64String(LocalMasterKey);

            var kmsProviders = new Dictionary<string, IReadOnlyDictionary<string, object>>();
            var localKey = new Dictionary<string, object>
            {
                { "key", localMasterKey }
            };
            kmsProviders.Add("local", localKey);

            var keyVaultNamespace = CollectionNamespace.FromFullName("admin.datakeys");
            var keyVaultMongoClient = new MongoClient();
            var clientEncryptionSettings = new ClientEncryptionOptions(
                keyVaultMongoClient,
                keyVaultNamespace,
                kmsProviders);

            var clientEncryption = new ClientEncryption(clientEncryptionSettings);
            var dataKeyId = clientEncryption.CreateDataKey("local", new DataKeyOptions(), CancellationToken.None);
            var base64DataKeyId = Convert.ToBase64String(GuidConverter.ToBytes(dataKeyId, GuidRepresentation.Standard));
            clientEncryption.Dispose();

            var collectionNamespace = CollectionNamespace.FromFullName("test.coll");

            var schemaMap = $@"{{
                properties: {{
                    encryptedField: {{
                        encrypt: {{
                            keyId: [{{
                                '$binary' : {{
                                    'base64' : '{base64DataKeyId}',
                                    'subType' : '04'
                                }}
                            }}],
                        bsonType: 'string',
                        algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
                        }}
                    }}
                }},
                'bsonType': 'object'
            }}";
            var autoEncryptionSettings = new AutoEncryptionOptions(
                keyVaultNamespace,
                kmsProviders,
                schemaMap: new Dictionary<string, BsonDocument>()
                {
                    { collectionNamespace.ToString(), BsonDocument.Parse(schemaMap) }
                });
            var clientSettings = new MongoClientSettings
            {
                AutoEncryptionOptions = autoEncryptionSettings
            };
            var client = new MongoClient(clientSettings);
            var database = client.GetDatabase("test");
            database.DropCollection("coll");
            var collection = database.GetCollection<BsonDocument>("coll");

            collection.InsertOne(new BsonDocument("encryptedField", "123456789"));

            var result = collection.Find(FilterDefinition<BsonDocument>.Empty).First();
            Console.WriteLine(result.ToJson());
        }
    }
}
```
 
Get current `libmongocrypt.so` binary (_not_ `mongocryptd`) for your platform and copy into the Nuget libraries:

```bash
mkdir libmongocrypt
cd libmongocrypt/
curl -LO 'https://s3.amazonaws.com/mciuploads/libmongocrypt/all/master/latest/libmongocrypt-all.tar.gz'
tar xzf libmongocrypt-all.tar.gz 
cp ./ubuntu1804-64/lib/libmongocrypt.so ~/.nuget/packages/mongodb.libmongocrypt/1.0.0-beta01/lib/netstandard1.5/
cd ..
```


## Confirm dependencies & execute


```bash
// dotnet restore
dotnet run
// alternatively: dotnet publish -c release -o publish -r linux-x64 && ./bin/release/netcoreapp2.2/linux-x64/csFLEExample
```
 
