export type FamilyRole = 'admin' | 'member';

export interface FamilyGroup {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface FamilyMember {
  family_id: string;
  user_id: string;
  role: FamilyRole;
  display_name: string | null;
  joined_at: string;
}

export interface FamilyContextData {
  family: FamilyGroup;
  membership: FamilyMember;
  members: FamilyMember[];
}
