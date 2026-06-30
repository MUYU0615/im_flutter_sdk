export interface ChatRoomOperationRequest {
  readonly operation: 'join' | 'leave';
  readonly chatRoomId: string;
  readonly ext?: string;
  readonly leaveOtherRooms?: boolean;
}
