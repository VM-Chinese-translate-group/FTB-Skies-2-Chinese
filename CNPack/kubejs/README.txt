目录信息:

assets 
资源——你可以把任何客户端资源放在这里，像纹理，模型等。示例:
 assets/kubejs/textures/item/test_item.png
 
data
数据——你可以把任何服务器资源放在这里，像战利品表，函数等。示例:data/kubejs/loot_tables/blocks/test_block.json

startup_scripts
游戏启动时加载一次的脚本——用于添加物品和其他只有在游戏加载时才会发生的事情(可以用/kubejs reload_startup_scripts重新加载，但可能不起作用！)

server_scripts
服务端脚本——每次服务器资源重新加载时加载的脚本——用于修改配方、标签、战利品表和处理服务器事件(可以用/reload指令重新加载)

client_scripts
客户端脚本——每次客户端资源重新加载时加载的脚本——用于JEI事件、tooltip和其他客户端事物(可以用F3+T重新加载)

config
配置——用于储存KubeJS配置。这也是除了世界目录导出之外脚本可以访问的唯一目录——像纹理和地图这样的数据转储在这里结束

你可以在logs/kubejs/目录中找到特定类型的日志
