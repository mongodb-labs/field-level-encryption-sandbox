/*
   ** Note: a local key file should only be used in a non-production test environment **
   Instructions for generate a local master key:
   
   For Linux & Mac, from a terminal:
     echo $(head -c 96 /dev/urandom | base64 | tr -d '\n')
   For Windows 8.x/2012+, from a command prompt:
     powershell -command "$r=[byte[]]::new(64);$g=[System.Security.Cryptography.RandomNumberGenerator]::Create();$g.GetBytes($r);[Convert]::ToBase64String($r)"
   Paste the hex string generated above into the key string value below
*/

env.keyString = "PASTE GENERATED KEY STRING HERE";

env.connStr = "localhost"
// For Atlas:
//  env.connStr = "mongodb+srv://USERNAME:PASSWORD@cluster1-sample.mongodb.net"
// For on-prem TLS:
//  env.connStr = "mongodb://USERNAME:PASSWORD@example.com:27017/?authMechanism=SCRAM-SHA-256&replicaSet=rs1"
