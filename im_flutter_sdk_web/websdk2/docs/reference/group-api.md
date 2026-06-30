api 返回数据

获取加入的群组 ：
{
"properties": {},
"uri": "http://a1-hsb.easemob.com/easemob-demo/chatdemoui/users/zd1/joined_chatgroups",
"timestamp": 1775645164632,
"organization": "easemob-demo",
"applicationName": "chatdemoui",
"application": "2a8f5b13-248c-4a6b-958a-838fd47f1223",
"entities": [],
"count": 1,
"action": "get",
"data": [
{
"groupid": "310637239533569",
"groupname": "",
"disabled": "false"
}
],
"params": {
"pagesize": [
"50"
],
"pagenum": [
"0"
]
},
"duration": 0
}

获取群详情：
{
"properties": {},
"uri": "http://a1-hsb.easemob.com/easemob-demo/chatdemoui/chatgroups/310637239533569",
"timestamp": 1775645265454,
"organization": "easemob-demo",
"applicationName": "chatdemoui",
"application": "2a8f5b13-248c-4a6b-958a-838fd47f1223",
"entities": [],
"count": 1,
"action": "get",
"data": [
{
"id": "310637239533569",
"name": "",
"description": "测试群组描述呀",
"membersonly": false,
"allowinvites": true,
"maxusers": 199,
"owner": "zd1",
"created": 1775645157182,
"custom": "",
"mute": false,
"affiliations_count": 1,
"avatar": "",
"disabled": false,
"affiliations": [
{
"owner": "zd1",
"joined_time": 1775645157212
}
],
"public": false,
"shieldgroup": false
}
],
"params": {
"joined_time": [
"true"
]
},
"duration": 0
}

获取群组管理员列表
{
"properties": {},
"uri": "http://a1-hsb.easemob.com/easemob-demo/chatdemoui/chatgroups/310637239533569/admin",
"timestamp": 1775645385371,
"organization": "easemob-demo",
"applicationName": "chatdemoui",
"application": "2a8f5b13-248c-4a6b-958a-838fd47f1223",
"entities": [],
"count": 1,
"action": "get",
"data": [
"zd2"
],
"duration": 0
}

获取群组成员
{
"properties": {},
"uri": "http://a1-hsb.easemob.com/easemob-demo/chatdemoui/chatgroups/310637239533569/users",
"timestamp": 1775645511697,
"organization": "easemob-demo",
"applicationName": "chatdemoui",
"application": "2a8f5b13-248c-4a6b-958a-838fd47f1223",
"entities": [],
"count": 3,
"action": "get",
"data": [
{
"member": "zd3"
},
{
"member": "zd2"
},
{
"owner": "zd1"
}
],
"params": {
"\_v": [
"1775645511491"
],
"pagesize": [
"5"
],
"pagenum": [
"1"
]
},
"duration": 0
}

获取禁言列表
{
"properties": {},
"uri": "http://a1-hsb.easemob.com/easemob-demo/chatdemoui/chatgroups/310637239533569/mute",
"timestamp": 1775645552918,
"organization": "easemob-demo",
"applicationName": "chatdemoui",
"application": "2a8f5b13-248c-4a6b-958a-838fd47f1223",
"entities": [],
"action": "post",
"data": [],
"duration": 0
}

获取黑名单
{
"properties": {},
"uri": "http://a1-hsb.easemob.com/easemob-demo/chatdemoui/chatgroups/310637239533569/blocks/users",
"timestamp": 1775645575439,
"organization": "easemob-demo",
"applicationName": "chatdemoui",
"application": "2a8f5b13-248c-4a6b-958a-838fd47f1223",
"entities": [],
"count": 0,
"action": "get",
"data": [],
"duration": 0
}

获取allowlist
{
"properties": {},
"uri": "http://a1-hsb.easemob.com/easemob-demo/chatdemoui/chatgroups/310637239533569/white/users",
"timestamp": 1775645596615,
"organization": "easemob-demo",
"applicationName": "chatdemoui",
"application": "2a8f5b13-248c-4a6b-958a-838fd47f1223",
"entities": [],
"count": 2,
"action": "get",
"data": [
"zd1",
"zd2"
],
"duration": 0
}

获取群公告
{
"properties": {},
"uri": "http://a1-hsb.easemob.com/easemob-demo/chatdemoui/chatgroups/310637239533569/announcement",
"timestamp": 1775645637235,
"organization": "easemob-demo",
"applicationName": "chatdemoui",
"application": "2a8f5b13-248c-4a6b-958a-838fd47f1223",
"entities": [],
"count": 0,
"action": "get",
"data": {
"announcement": ""
},
"duration": 0
}

共享文件列表

{
"uri": "http://a1-hsb.easemob.com/easemob-demo/chatdemoui/chatgroups/310637239533569/sharefiles",
"timestamp": 1775645702780,
"organization": "easemob-demo",
"application": "2a8f5b13-248c-4a6b-958a-838fd47f1223",
"entities": [],
"count": 2,
"action": "get",
"data": [
{
"file_id": "62801670-3339-11f1-8f33-6fb173041e99",
"created": 1775645698448,
"file_owner": "zd1",
"file_name": "index.html",
"file_size": 959
},
{
"file_id": "5587c670-3339-11f1-a58d-857a8989199d",
"created": 1775645676635,
"file_owner": "zd1",
"file_name": "{b62:}",
"file_size": 9
}
],
"params": {
"pagesize": [
"20"
],
"pagenum": [
"1"
]
},
"duration": 0,
"applicationName": "chatdemoui",
"properties": {}
}

批量获取成员属性
{
"timestamp": 1775645796651,
"data": {
"zd3": {
"nickname": "nickName",
"avatar": "avatar url"
}
},
"duration": 2
}

获取消息已读成员
{
"action": "group_read_ack",
"data": {
"ackmid": "1537950049114274844",
"userlist": [],
"total": 0,
"next_key": "",
"is_last": true,
"timestamp": 1775646716085
},
"timestamp": 1775646716068,
"duration": 17,
"properties": {}
}
