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
  historySource: "owned" | "collab";
  relationType: string;
  sceneName: string;
  isFavorite?: boolean;
  isCollabEnabled?: boolean;
  version: number;
  size: number;
  createdByUserId: number;
  lastWriteUserId: number;
  lastVisitedAt?: number;
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
  collabAccessMode: "private" | "invite";
  currentRoomId: string;
  isCollabEnabled: boolean;
  isFavorite: boolean;
  memberCount: number;
  latestSceneRecordId: number;
  lastActivatedAt?: number;
  lastOpenedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type SceneMemberSummary = {
  userId: number;
  username: string;
  displayName: string;
  relationType: string;
  role: string;
  lastVisitedAt?: number;
};

export type SceneDetailRecord = SceneRecord & {
  ownershipType: string;
  viewerRole: string;
  isFavorite: boolean;
  memberCount: number;
  members: SceneMemberSummary[];
};

export type AddSceneMemberResult = {
  sceneId: number;
  member: SceneMemberSummary;
};

export type RemoveSceneMemberResult = {
  sceneId: number;
  memberUserId: number;
};

export type UpdateSceneMemberRoleResult = {
  sceneId: number;
  member: SceneMemberSummary;
};

export type SceneListResult = {
  items: SceneRecord[];
  total: number;
};
