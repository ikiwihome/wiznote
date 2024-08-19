FROM wiznote/wizserver:latest

EXPOSE 80

# 解除会员权限
COPY ./NodeRSA.js /wiz/app/wizserver/node_modules/node-rsa/src/NodeRSA.js

# 删除当前路径及其子目录下所有以 ._ 开头的无用文件
RUN find . -type f -name '._*' -exec rm -f {} +

# 将xapp从0.1.90升级到0.1.107
RUN mv /wiz/app/wizserver/web/prod/xapp/0.1.90 /wiz/app/wizserver/web/prod/xapp/0.1.107

COPY ./xapp /wiz/app/wizserver/web/prod/xapp/
COPY ./xapp /wiz/app/wizserver/web/prod/xapp/0.1.107/
RUN chown -R 501:games /wiz/app/wizserver/web/prod/xapp/*

# 删除wapp中的百度跟踪
COPY ./www/index.html /wiz/app/wizserver/web/prod/www/index.html
RUN chown -R 501:games /wiz/app/wizserver/web/prod/www/index.html

# 删除wapp中的Google跟踪
COPY ./wapp/main.5615c142.chunk.js /wiz/app/wizserver/web/prod/wapp/static/js/main.5615c142.chunk.js
RUN chown -R 501:games /wiz/app/wizserver/web/prod/wapp/static/js/main.5615c142.chunk.js