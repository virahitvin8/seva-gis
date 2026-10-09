#!/bin/sh
# Run after each deploy to tell Bing and other IndexNow engines about your pages.
curl -X POST "https://api.indexnow.org/IndexNow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "host": "sevagis.dpdns.org",
    "key": "cd55f858503b8ae0f09c19357f5e1109",
    "keyLocation": "https://sevagis.dpdns.org/cd55f858503b8ae0f09c19357f5e1109.txt",
    "urlList": [
      "https://sevagis.dpdns.org/",
      "https://sevagis.dpdns.org/how-it-works.html",
      "https://sevagis.dpdns.org/ndvi-explained.html",
      "https://sevagis.dpdns.org/faq.html"
    ]
  }'
