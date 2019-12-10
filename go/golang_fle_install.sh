# Debian & Ubuntu Go Environment Rerequisites
#
# sudo apt-get install libssl-dev cmake pkg-config build-essential
# 

# Purge libmongocrypt from any existing local shared libary cache
sudo rm -rf /usr/local/lib/libmongocrypt*
sudo /sbin/ldconfig

git clone https://github.com/mongodb/libmongocrypt

# replace git@github with https://github.com/
sed -i 's|git@github.com:mongodb|https://github.com/mongodb|g' \
./libmongocrypt/.evergreen/prep_c_driver_source.sh

# There will now be a ./install directory containing libmongocrypt pkg-config files

./libmongocrypt/.evergreen/compile.sh 

# Install libmongocrypt.so files & relative symlinks into default OS library path
sudo cp -P ./install/libmongocrypt/lib/libmongocrypt* /usr/local/lib

# Update the local shared libary cache and verify mongocrypt made it
sudo /sbin/ldconfig
sudo /sbin/ldconfig -p | grep crypt

# Don't need source any more
rm -rf libmongocrypt
rm -rf mongo-c-driver
rm -rf cmake-build
rm -rf install

# Build Go example, enabling CSFLE option

go build -tags cse src/main.go

# Copy *.json files to current directory
./main
