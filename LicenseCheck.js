var fs = require('fs');
var config = require('config.json')('./config.json');
var request = require('request');
var mail = require('nodemailer');
var HttpStatus = require('http-status-codes');
var cheerio = require('cheerio');

// Parameters & Defaults

var mailEnabled = isTrue(coalesce(config.mailEnabled, process.env.mailEnabled, true)); //Send Mail, Default = true
var verbose = isTrue(coalesce(config.verbose, process.env.verbose, false)); // Default = Don't show mail output
var delay = parseInt(coalesce(config.delay, process.env.delay, 200)); //Delay between requests
var dmv_site = coalesce(config.dmv_site, process.env.dmv_site, "https://mndriveinfo.org/dvsinfo/dv02/DV02.asp?Number={0}"); //DMV Website
var valid_text = coalesce(config.valid_text, process.env.valid_text, "VALID"); //DMV Website
var tz_utc_offset = parseFloat(coalesce(config.tz_utc_offset, process.env.tz_utc_offset, -(new Date().getTimezoneOffset()/60)));
var tz_name = coalesce(config.tz_name, process.env.tz_name, getTimezoneAbbreviation())

// Load Configuration

var licenses = config.licenses;

var smtp = mail.createTransport({
  host: coalesce(config.smtp && config.smtp.host, process.env.smtp_host, "localhost"),
  port: parseInt(coalesce(config.smtp && config.smtp.port, process.env.smtp_port, 25)),
  secure: isTrue(coalesce(config.smtp && config.smtp.secure, process.env.smtp_secure, false)),
  auth: {
    user: coalesce(config.smtp && config.smtp.user, process.env.smtp_user, "licensecheck"),
    pass: coalesce(config.smtp && config.smtp.password, process.env.smtp_password, "password")
  }
}, {
  // default values for sendMail
  from: coalesce(config.from, process.env.from, "LicenseCheck")
});

// Scraping

var results = [];
var errors = [];

function checkAll(results) {
  console.log();
  console.log(" === Beginning MN Driver's License Checks === ");
  console.log();

  var remaining = 0;

  licenses.forEach(function(license, index) {
    setTimeout(function() {
        remaining++;
        check(license.name, license.email, license.license, function() {
          remaining--;
          if (remaining == 0)
            finished();
        });
      }, index * delay);
  });
}

function check(name, email, license, callback) {
  var url = dmv_site.format(license);

  request(url, function(error, response, html) {

    if(error || response.statusCode != 200) {
      console.log("Error checking '{0}'!".format(name));
      var message = error || "{0} ({1})".format(HttpStatus.getStatusText(response.statusCode), response.statusCode);
      errors.push({name: name, url: url, message: message});
    }
    else {
      if (verbose)
        console.log("Checking '{0}'...\n({1})".format(name, url));
      else
        process.stdout.write("Checking '{0}'... ".format(name));

      //Get Data
      var $ = cheerio.load(html);

      var result = {
        name: name,
        email: email,
        url: url,
        license: $("td").eq(1).text().trim(),
        class: $("td").eq(2).text().trim(),
        type: $("td").eq(3).text().trim(),
        status: $("td").eq(4).text().trim(),
        commercial: $("td").eq(5).text().trim(),
        endorsements: $("td").eq(6).text().trim(),
        restrictions: $("td").eq(7).text().trim(),
        issueDate: $("td").eq(8).text().trim(),
        expireDate: $("td").eq(9).text().trim(), 
      }

      if (verbose)
        console.log(result);
      else
        console.log("{0}: {1} {2}{3} ({4}) {5}-{6}".format(result.license, result.status, result.class, result.type, result.endorsements, result.issueDate, result.expireDate));
 
      //Send Email???  
      if (verbose) {
        console.log();
        console.log(" -------- EMAIL ---------");
        console.log();
        console.log(formatEmail(result, errors));
        console.log(); 
        console.log(" --------  END  ---------");
      }

      if (mailEnabled == true && result.email && (result.status != valid_text || errors.length > 0)) {
        if (result.status != valid_text)
          process.stdout.write("Invalid license found, sending mail... ");
        else 
          process.stdout.write("Errors present, sending mail... ");

        smtp.sendMail({
          to: email,
          subject: 'LicenseCheck Warning - License status {0}!{1}'.format(result.status, errors.length > 0 ? " --- {0} error{1} present!".format(errors.length, errors.length>1 ? "s" : "") : ""),
          //text: formatEmail(result, errors) // Plain Text
          html: formatEmail(result, errors, true) //HTML
          }, function(error, response) {
          if (error) {
            console.log("Error Sending Mail: " + error);
          } else {
            console.log("Email Sent to: {0}.".format(email));
          }
        });
      }

      if (callback) callback();
    }
  });
}

function finished() {
  console.log();

  if (errors.length > 0) {
    console.log(" --- Errors Present! ---");
    console.log();
  }

  console.log(" === {0} License Checks Finished === ".format(licenses.length));
  console.log();

  updateLastRun();
}

function updateLastRun() {
  var contents = formatDate(new Date());
  if (errors.length > 0)
    contents += "\n\n" + formatErrors(errors);
  fs.writeFile("LastRun.txt", contents, function(err) {
    if(err) {
      return console.log(err);
    }
  }); 
}

// Helper Functions

if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined' ? args[number] : match;
    });
  };
}

if (!Date.prototype.toUTC) {
  Date.prototype.toUTC = function() {
    return new Date(this.getTime() + this.getTimezoneOffset() * 60000);
  };
}

function isTrue(value){
  if (typeof(value) == 'string'){
    value = value.toLowerCase();
  }
  switch(value){
    case true:
    case "true":
    case 1:
    case "1":
    case "on":
    case "yes":
      return true;
    default: 
      return false;
  }
}

months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(date) {
  var ampm = date.getHours() >= 12 ? "PM" : "AM";
  var hours = date.getHours() % 12;
  if (hours == 0) hours = 12;
  return "{0}.{1}.{2} {3}:{4} {5}".format(date.getFullYear(), pad(date.getMonth() + 1, 2), pad(date.getDate(), 2), hours, pad(date.getMinutes(), 2), ampm);
}

function getTimezoneAbbreviation(date) {
  date = date || new Date();
  var s = date.toString().split("(");
  if (s.length == 2) {
    var n = s[1].replace(")", "");
    return n.match(/[A-Z]/g).join("");
  }
  return "UTC";
}

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function coalesce() {
  var i, undefined, arg;
  for(i = 0; i < arguments.length; i++) {
    arg = arguments[i];
    if( arg !== null && arg !== undefined && (typeof arg !== 'number' || arg.toString() !== 'NaN') ) {
      return arg;
    }
  }
  return null;
}

// Email

function formatEmail(result, errors, html) {
  var newline = html == true ? "<br/>" : "\n";
  var body = "";

  body += formatResult(result, html) + newline;
  
  if (errors.length > 0) {
    body += (html == true ? "<h2>Errors</h2>" : " === Errors ===") + newline;
    body += formatErrors(errors, html) + newline;
  }
  
  body += html == true ? "<b> - Sent by LicenseCheck</b>" : " - Sent by LicenseCheck";
  body += " (Email generated {0} {1})".format(formatDate(new Date(new Date().toUTC().getTime() + tz_utc_offset * 3600000)), tz_name);
  
  return body;
}

function formatResult(result, html) {
  var newline = html == true ? "<br/>" : "\n";
  var s = "";

  s += (html == true ? "<b>{0}</b> {1}: <b>{2}</b> {3}{4} ({5}) {6} - {7} <i>(Restrictions: {8})</i>" : "{0} {1}: {2} {3}{4} ({5}) {6} - {7} (Restrictions: {8})").format(result.name, result.license, result.status, result.class, result.type, result.endorsements, result.issueDate, result.expireDate, result.restrictions);
  s += newline;
  s += newline;

  if (html == true)
    s += '<a href="{0}" title="Click here to recheck">{0}</a>'.format(result.url);
  else
    s += result.url;
  s += newline;

  return s;
}

function formatErrors(errors, html) {
  var newline = html == true ? "<br/>" : "\n";
  var s = "";
  errors.forEach(function(error, index) {
    s += (html == true ? "Error scraping '{0}': <b>{1}</b>{2}" : "Error scraping '{0}': {1} ").format(error.name, error.message, newline);
    if (html == true)
      s += '<a href="{0}" title="Link">{0}</a>'.format(error.url);
    else
      s += error.url;
    s += newline;
  });
  return s;
}

//Begin Checks

checkAll(results);

//Exports
