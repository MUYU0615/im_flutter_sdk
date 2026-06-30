/**
 * [zh-CN] 发送者信息。
 * [en-US] Sender information.
 */
export interface Sender {
  /** [zh-CN] 发送者用户 ID。 [en-US] Sender user ID. */
  userId: string;
  /** [zh-CN] 发送者昵称。 [en-US] Sender nickname. */
  nickname?: string;
  /** [zh-CN] 发送者头像地址。 [en-US] Sender avatar URL. */
  avatarUrl?: string;
}
