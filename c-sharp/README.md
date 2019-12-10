Dependecies:
```batch
dotnet add package MongoDB.Driver --version 2.10.0-beta1
dotnet add package MongoDB.Driver.Core --version 2.10.0-beta1
dotnet add package MongoDB.Bson --version 2.10.0-beta1
dotnet add package MongoDB.Libmongocrypt --version 1.0.0-beta01

powershell -C "start-process %ProgramFiles%\mongodb\server\4.2\bin\mongocryptd.exe --pidfilepath=%USERPROFILE%\AppData\Local\Microsoft\WindowsApps\mongocryptd.pid"
powershell -C "write-host -nonewline \"`n mongocryptd is \"; if (!(get-process mongocryptd -erroraction silentlycontinue)) { write-host -nonewline 'NOT ' }; echo 'running.'"
```

Note: mongocryptd is *NOT* needed for shell - it's integrated into Enterprise shell

```
%ProgramFiles%\mongodb\server\4.2\bin\mongo --shell hello_world_shell.js

```
