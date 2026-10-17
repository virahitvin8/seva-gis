<!--
YOU MUST FILL OUT THIS ENTIRE TEMPLATE FOR YOUR PR TO BE APPROVED!

DO NOT MODIFY OR REMOVE THIS TEMPLATE (INCLUDING REMOVING COMMENTS) OR YOUR PR WILL FAIL VALIDATION!
-->

# Requirements
<!-- Your domain MUST pass ALL the requirements below, otherwise it WILL BE DENIED. -->
<!-- Change each checkbox to [x] (all lowercase, with no spaces between the brackets) to mark it as completed. -->
<!-- Do not modify anything in this section other than the checkboxes, or your PR will fail validation. -->

- [x] <!-- TOS --> I **agree** to the [Terms of Service](https://is-a.dev/terms). <!-- Your request MUST follow the TOS to be approved. -->
- [x] <!-- DOMAIN_STRUCTURE --> My file is following the [domain structure](https://docs.is-a.dev/domain-structure/). <!-- Your file is in the domains directory, the name is valid, it is JSON format, etc. -->
- [x] <!-- WEBSITE_REACHABLE --> My website is **reachable** and **completed**. <!-- We do not permit simple "Hello, world!" or simply copied template websites. -->
- [x] <!-- RECORD_TYPES --> The record types are supported for my requested domain. <!-- For most subdomains, only A, AAAA, and CNAME records are supported. Check the documentation for more information. -->
- [x] <!-- NO_OFFENSIVE_DOMAINS --> My domain does not contain NSFW, offensive, or discriminatory words. <!-- In addition to English, this includes any words in other languages. If your domain is deemed inappropriate, your pull request will be denied. -->

# Description
<!-- Tell us more about your website! If you're a student or working on this for a school project, please let us know in this section! -->
SEVA·GIS is a free, open-source, browser-first spatial analysis platform for Indian agriculture ("Where Satellites Meet Soil").
Built for farmers, researchers, and agronomists, it ingests Sentinel-2 L2A optical bands and Copernicus DEM terrain data to compute 30+ precision vegetative, hydrological, and mineral indices directly client-side.

- **Live URL**: https://sevagis.dpdns.org
- **Open-Source Repository**: https://github.com/virahitvin8/seva-gis
- **Target Subdomain**: `sevagis.is-a.dev`
- **Domain JSON file location**: `domains/sevagis.json`
- **Record**:
```json
{
  "owner": {
    "username": "virahitvin8",
    "email": "akshitvinay4636@gmail.com"
  },
  "records": {
    "CNAME": "sevagis.dpdns.org"
  }
}
```
