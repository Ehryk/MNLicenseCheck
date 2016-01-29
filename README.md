MNLicenceCheck v1.2
===================

Checks MN driver's license numbers and sends the owner an email if the status is not "VALID" or if it is expiring soon.

Usage:
---
 - ``node LicenseCheck.js``
 - ``node LicenseCheck.js --verbose=true --mailEnabled=false``

Release History:
---
 - v1.2 2016.01.29 Added check for days until expiration
 - v1.1 2016.01.27 Small fixes and improvements, added sample config
 - v1.0 2016.01.26 Initial Release

Author:
 - Eric Menze ([@Ehryk42](https://twitter.com/Ehryk42))

Build Requirements:
---
 - Node.js (Built with Node v4.0.0)
 - NPM Packages
   - [request](https://www.npmjs.com/package/request) - Making HTTP Requests
   - [cheerio](https://www.npmjs.com/package/cheerio) - Server side request parsing with jQuery syntax
   - [nodemailer](https://www.npmjs.com/package/nodemailer) - Sending Email
   - [http-status-codes](https://www.npmjs.com/package/http-status-codes) - Retrieve HTTP status code text representations
   - [config.json](https://www.npmjs.com/package/config.json) - Load from a config file and parameters

Contact:
---
Eric Menze
 - [Email Me](mailto:rhaistlin+gh@gmail.com)
 - [Portfolio](http://ericmenze.com)
 - [Github](https://github.com/Ehryk)
 - [Twitter](https://twitter.com/Ehryk42)
 - [Source Code](https://github.com/Ehryk/AmmoCheck)
