export type AuthUser = {
  userId: number;
  username: string;
  displayName: string;
  role: string;
  status: string;
  createdAt?: number;
  updatedAt?: number;
};

export type AuthRegisterPayload = {
  username: string;
  password: string;
  displayName?: string;
};

export type AuthChangePasswordPayload = {
  oldPassword: string;
  newPassword: string;
};

export type AuthUpdateProfilePayload = {
  displayName: string;
};

export type AuthResetPasswordPayload = {
  username: string;
};

export type AuthResetPasswordResult = {
  username: string;
  temporaryPassword: string;
};

export type AdminUserListItem = AuthUser;

export type AdminUserListResult = {
  items: AdminUserListItem[];
  total: number;
};

export type AuthSceneHistoryItem = {
  sceneId: number;
  sceneRecordId: number;
  roomId: string;
  roomKey?: string;
  canOpenCollab: boolean;
  sceneName: string;
  version: number;
  size: number;
  createdByUserId: number;
  lastWriteUserId: number;
  createdAt: number;
  updatedAt: number;
};

export type AuthSceneHistoryResult = {
  items: AuthSceneHistoryItem[];
  total: number;
};

export type SceneOpenCollabResult = {
  sceneId: number;
  sceneName: string;
  roomId: string;
  roomKey: string;
  isNewRoom: boolean;
};

export type SceneRecord = {
  sceneId: number;
  ownerUserId: number;
  sceneName: string;
  status: string;
  currentRoomId: string;
  isCollabEnabled: boolean;
  latestSceneRecordId: number;
  lastActivatedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type SceneListResult = {
  items: SceneRecord[];
  total: number;
};
