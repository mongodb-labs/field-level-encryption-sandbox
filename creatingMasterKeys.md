## Creating master keys (local or KMS) for client-side field level encryption

Note: See [KMS Best Practices](https://d0.awsstatic.com/whitepapers/aws-kms-best-practices.pdf) guide for more specific guidance:
> _You should work to ensure that the corresponding key policies follow a model of least privilege. This includes ensuring that you do NOT include `kms:* ` permissions in an IAM policy._

### Note: This tutorial will create both an AWS KMS master key as well as a local key. If planning to use _only_ a local key, skip to [Step 4](#4-create-a-local-master-key-file).

### 1. Create a project-specific Master Key
  - In the AWS management console, create a project-specific master key:
    - *Key Management Service (KMS) / Customer managed keys / Create a key*
    - _*Customer managed key*_
    - _Alias (ex.): `proj01-kms-client-master-key01`_
    - _Advanced options_
      - [ x ] KMS _(recommended for auto-rotation, but external or CloudHSM can be selected instead)_
  - *Add Tag key/value: (optional)*
  - *Key administrators:*
    - _(leave blank for now)_
  - *Key deletion*
    - _[ x ] Allow key administrators to delete this key (optional)_
  - _Define key usage permissions:_
    - _(leave blank for now)_
  - _Review and edit key policy:_
    - _(the default policy should restrict usage to the current admin for kms actions only)_
   - _Finish_
  - Review key summary and *copy & save* key ARN value:
    - _Ex: `arn:aws:kms:us-east-1:1234:key/abcd-abcd-012345`_
### 2. Create a purpose-generated IAM policy for the Master Key just created
  - _Idenity and Access Management (IAM) / Policies_
    - Create Policy
      -  Service / Choose / KMS
        -  Access level
            - [ x ] Write - Decrypt
            - [ x ] Write - Encrypt
        - Resources / key
          - _Specific_
            - key / Add ARN
              - _[ ARN value for key created above ]_
            - _Add_
      - Review policy
      - Name: _(ex.) `proj01-kms-key01-encrypt-decrypt-policy`_
      - Create policy
     
### 3. Create a purpose-generated IAM service account to use project Master Key
  - _Identity and Access Management (IAM) / Users_
    - _Add user_
    - _User name: (ex) `proj01-kms-key01-encrypt-decrypt-service-account`_
    - _[ x ] Programmatic access_
  - Permissions
  - Attach existing policies directly
  - _Filter: (ex) `proj01`_
    - _[ x ] (ex) `proj01-kms-key01-encrypt-decrypt-policy`_
  - Add tags (optional)
  - Review
  - Create user
  - Secret access key / Show
    - _(copy Access key ID and Secret access key, along with master key ARN from above and save)_

### 4. Create a local Master Key file (not needed if using a KMS provider master key)

_*Note: a local key file should only be used in a non-production test environment.*_

 - For Linux & Mac, from a terminal:
   - `echo $(head -c 96 /dev/urandom | base64 | tr -d '\n')`
 - For Win 8.x/2012+, from a command prompt:
   - ` powershell -command "$r=[byte[]]::new(96);$g=[System.Security.Cryptography.RandomNumberGenerator]::Create();$g.GetBytes($r);[Convert]::ToBase64String($r)"`

