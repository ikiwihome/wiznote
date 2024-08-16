FROM wiznote/wizserver:latest

EXPOSE 80

COPY ./NodeRSA.js /wiz/app/wizserver/node_modules/node-rsa/src/NodeRSA.js
COPY ./index.html /wiz/app/wizserver/web/prod/xapp/index.html
COPY ./index.html /wiz/app/wizserver/web/prod/xapp/0.1.90/index.html
COPY ./renderer.dev.js /wiz/app/wizserver/web/prod/xapp/renderer.dev.js
COPY ./renderer.dev.js /wiz/app/wizserver/web/prod/xapp/0.1.90/renderer.dev.js
