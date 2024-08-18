FROM wiznote/wizserver:latest

EXPOSE 80

# 解除会员权限
COPY ./NodeRSA.js /wiz/app/wizserver/node_modules/node-rsa/src/NodeRSA.js

# 删除wapp中的Google跟踪和阿里CDN跟踪
COPY ./xapp/index.html /wiz/app/wizserver/web/prod/xapp/index.html
COPY ./xapp/index.html /wiz/app/wizserver/web/prod/xapp/0.1.90/index.html
COPY ./xapp/renderer.dev.js /wiz/app/wizserver/web/prod/xapp/renderer.dev.js
COPY ./xapp/renderer.dev.js /wiz/app/wizserver/web/prod/xapp/0.1.90/renderer.dev.js
COPY ./xapp/manifest.mobile.json /wiz/app/wizserver/web/prod/xapp/manifest.mobile.json
COPY ./xapp/manifest.mobile.json /wiz/app/wizserver/web/prod/xapp/0.1.90/manifest.mobile.json

# 删除wapp中的百度跟踪
COPY ./www/index.html /wiz/app/wizserver/web/prod/www/index.html

# 删除wapp中的Google跟踪
COPY ./wapp/main.5615c142.chunk.js /wiz/app/wizserver/web/prod/wapp/static/js/main.5615c142.chunk.js