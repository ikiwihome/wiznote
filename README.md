# wiznote
为知笔记Docker镜像修改仓库，解除所有功能限制，不显示VIP相关信息

## Docker私有化部署

```
docker run -d --name wiznote -h wiznote --restart=unless-stopped -e TZ="Asia/Shanghai" --log-opt max-size=10m -v /data/wizdata:/wiz/storage -v /etc/localtime:/etc/localtime -e SEARCH=true ikiwicc/wiznote:latest
```

## Nginx反向代理设置

```
server {
  server_name _;
  listen 80;
  location =/robots.txt {
        default_type text/html;
        add_header Content-Type "text/plain; charset=UTF-8";
        return 200 "User-Agent: *\nDisallow: /";
    }
  location ^~ /wapp {
     rewrite ^/wapp  /xapp permanent;
    }
  location / {
    # wiznote;
    proxy_pass http://yourip:80/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header x-wiz-real-ip $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto "https";
  }
}
```
