# wiznote
为知笔记Docker镜像修改仓库，解除所有功能限制，不显示VIP相关信息

## Docker私有化部署

```
docker run -d --name wiznote -h wiznote --restart=unless-stopped -e TZ="Asia/Shanghai" --log-opt max-size=10m -v /data/wizdata:/wiz/storage -v /etc/localtime:/etc/localtime -e SEARCH=true -p 8080:80 ikiwicc/wiznote:latest
```

### Docker参数说明
-v /data/wizdata:/wiz/storage 数据持久化
-v /etc/localtime:/etc/localtime 设置容器内时区与宿主机一致
-p 8080:80 笔记服务端口映射
-e SEARCH=true 开启全文搜索模式，开启时全局搜索可以直接搜索笔记中的内容，未开启则只搜索笔记标题。特别注意：实测wiznote服务常驻内存800M左右，开启全文搜索后常驻1.1G，文章数量增加后还会上升，请自行注意服务器内存使用。
ikiwicc/wiznote:latest 使用博主修改的镜像，基于官方最新镜像封装。
官方要求映射9269端口的udp流量，但是实测没啥用。

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
