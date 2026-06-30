if (
		ignoreMyOwnMsg &&
		meta.from &&
		meta.from.name === this.context.userId &&
		meta.from.clientResource === this.clientResource &&
		thirdMessage.type === MsyncMessageType.CHATROOM
	) {
		return logger.debug('Discard your own chat room message:', msgId);
	}
1. 这种细节人是了解的， 怎么让AI知道，细节一直写spec其实没有人直接写效率高 - docs/process/spec-management.md
2. 实现代码时怎么让 AI 参考现有代码 - docs/process/reference-existing-code.md
3. 如果对 AI 写的代码不满意，应该直接修改代码？spec? plan? task? - docs/process/code-modification-guide.md
4. 项目积累的 spec 有什么用？ 太多了怎么管理？ - docs/process/spec-management.md
5. spec-kit的工作原理，是标准协议吗？AI 会自动读取吗？- docs/process/how-spec-kit-works.md

6. sendMessage 方法属于 chatClient 还是 channel
7. 所有代码都让 AI 写， token 不够
8. 代码都有 AI 生成，是否容易不可控


