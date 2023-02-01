const { users } = require('./users');
const { messages } = require('./messages'); 
const http = require('http');
const Koa = require('koa');
const koaBody = require('koa-body');
const WS = require('ws');
const Router = require('koa-router');
const { cli } = require('forever');
const app = new Koa();

app.use(koaBody({
  urlencoded: true,
}));

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }
  
  const headers = { 'Access-Control-Allow-Origin': '*', };
  
  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }
  
  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    });
    
    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
    }
    
    ctx.response.status = 204;
  }
});

//TODO: write code here

const router = new Router();

router.get('/users', async (ctx) => {
  ctx.response.body = JSON.stringify(users);
});

router.get('/messages', async (ctx) => {
  ctx.response.body = JSON.stringify(messages);
});

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());

const wsServer = new WS.Server({
  server
});


wsServer.on('connection', (ws) => {
  
  ws.on('message', (message) => {
    
    const data = JSON.parse(message);
    switch (data.type) {
      case 'input' : 
      const res = users.findIndex(item => item.nickname === data.name);
      if (res<0) {
        users.push({nickname: data.name});
        
        Array.from(wsServer.clients)
        .filter(client => client.readyState === WS.OPEN && client !== ws)
        .forEach(client => {
          const msg = {
            type: 'user_ok',
            name: data.name            
          }
          client.send(JSON.stringify(msg));          
        });
        ws.send(JSON.stringify({
          type: 'input_ok',
          added_name: data.name
        }));            
        
      } else {
        ws.send(JSON.stringify({
          type: 'false_name'
        }));
      }      
      break;
      
      case 'output' :
      const idx = users.findIndex(item => item.nickname === data.name);
      users.splice(idx, 1);
      const delUserName = data.name;
      
      Array.from(wsServer.clients)
      .filter(client => client.readyState === WS.OPEN && client !== ws)
      .forEach(client => {
        const msg = {
          type: 'out_user',
          name: delUserName            
        }
        client.send(JSON.stringify(msg));          
      });
      ws.send(JSON.stringify({
        type: 'logout',
        name: data.name
      }));
      break;
      
      case 'send_msg' :
      const userMsg = {
        name: data.name,
        date: data.date,
        content: data.content
      }      
      messages.push(userMsg);
      
      Array.from(wsServer.clients)
      .filter(client => client.readyState === WS.OPEN)
      .forEach(client => { 
        const msg = {
          type: 'get_msg',
          msg_data: userMsg
        }
        client.send(JSON.stringify(msg));  
      });      
    }
  })
})

server.listen(port, (err) => {
  if (err) {
    return console.log('Error occured:', err)
  }
  console.log(`server is listening on ${port}`)
});

