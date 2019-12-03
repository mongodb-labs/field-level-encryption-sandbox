To run this example, make sure that the `mongocryptd` binary (from the Enterprise server package on MongoDB Downloads)
is either on a default path or has already been started:

```bash
cd /tmp ; mongocryptd 2>&1 > mongocryptd.log &
```

Then create a simple "hello world" project, copying the 2 Node.js files in this repo:

```bash
mkdir hello; cp dataKeys.js hello ; cp helloWorld.js hello; cd hello
npm install mongodb mongodb-client-encryption --save
```

Next, create local test master & data keys: `node dataKeys.js`

Finally, run the helloWorld: `node helloWorld.js`

Inspect the results in a new mongo shell with an ordinary connection to see the encrypted record.
