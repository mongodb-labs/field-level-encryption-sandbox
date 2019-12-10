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
        
        private const string LocalMasterKey = "KThF4V/YH+pGMHF4p7VNMgfEcI1D30mXahpFPbaIVb4T+s6+/SJn3Cz/huyIiAHBqQ4bNz0eapehsWXdfn24e5I3bOKtrMhVJmbuxX2EehBxES1W3+HHHtJn6esBhWyf";

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
 
            var keyVaultDB = "keyVault";
            var keystore = "__keystore";
            var keyVaultNamespace = CollectionNamespace.FromFullName( $"{keyVaultDB}.{keystore}" );

            var keyVaultMongoClient = new MongoClient();
            var clientEncryptionSettings = new ClientEncryptionOptions(
                keyVaultMongoClient,
                keyVaultNamespace,
                kmsProviders);
            var clientEncryption = new ClientEncryption(clientEncryptionSettings);

            keyVaultMongoClient.GetDatabase( keyVaultDB ).DropCollection( keystore );
            
            var altKeyName = new[]{ "csharpDataKey01" };
            var dataKeyOptions = new DataKeyOptions(alternateKeyNames: altKeyName);         
            var dataKeyId = clientEncryption.CreateDataKey("local", dataKeyOptions, CancellationToken.None);
            var base64DataKeyId = Convert.ToBase64String(GuidConverter.ToBytes(dataKeyId, GuidRepresentation.Standard));
            clientEncryption.Dispose();

            var collectionNamespace = CollectionNamespace.FromFullName("test.coll");

            var schemaMap = $@"{{
                properties: {{
                    SSN: {{
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

            collection.InsertOne(new BsonDocument("SSN", "123456789"));

            var result = collection.Find(FilterDefinition<BsonDocument>.Empty).First();
            Console.WriteLine(result.ToJson());
        }
    }
}
