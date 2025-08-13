import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

export interface GroupSchema {
  id: string;
  name: string;
  color: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink' | 'indigo';
  isExpanded: boolean;
  position: number;
  metadata: {
    workspaceCount: number;
    createdAt: string;
    lastModified: string;
    description?: string;
    tags?: string[];
  };
}

export interface GroupListSchema {
  groups: Record<string, GroupSchema>;
}

export class GroupConfigService {
  private store: Store<GroupListSchema>;

  constructor() {
    this.store = new Store<GroupListSchema>({
      name: 'workspace-groups',
      defaults: { 
        groups: {} 
      },
    });
  }

  createGroup(name: string, color: GroupSchema['color'] = 'default'): { id: string; group: GroupSchema } {
    const id = uuidv4();
    const now = new Date().toISOString();

    const group: GroupSchema = {
      id,
      name,
      color,
      isExpanded: true,
      position: Date.now(),
      metadata: {
        workspaceCount: 0,
        createdAt: now,
        lastModified: now
      }
    };

    const groups = this.store.get('groups', {});
    this.store.set('groups', {
      ...groups,
      [id]: group
    });

    return { id, group };
  }

  getGroup(id: string): GroupSchema | null {
    const groups = this.store.get('groups', {});
    return groups[id] || null;
  }

  updateGroup(id: string, updates: Partial<Omit<GroupSchema, 'id' | 'metadata'>> & { metadata?: Partial<GroupSchema['metadata']> }): boolean {
    const groups = this.store.get('groups', {});
    const existingGroup = groups[id];
    
    if (!existingGroup) {
      return false;
    }

    const updatedGroup: GroupSchema = {
      ...existingGroup,
      ...updates,
      metadata: {
        ...existingGroup.metadata,
        ...(updates.metadata || {}),
        lastModified: new Date().toISOString()
      }
    };

    this.store.set('groups', {
      ...groups,
      [id]: updatedGroup
    });

    return true;
  }

  deleteGroup(id: string): boolean {
    const groups = this.store.get('groups', {});
    
    if (!groups[id]) {
      return false;
    }

    const { [id]: deleted, ...remaining } = groups;
    this.store.set('groups', remaining);
    
    return true;
  }

  listGroups(): GroupSchema[] {
    const groups = this.store.get('groups', {});
    return Object.values(groups).sort((a, b) => a.position - b.position);
  }

  groupExists(id: string): boolean {
    const groups = this.store.get('groups', {});
    return !!groups[id];
  }

  updateWorkspaceCount(groupId: string, increment: number): boolean {
    const groups = this.store.get('groups', {});
    const group = groups[groupId];
    
    if (!group) {
      return false;
    }

    const updatedGroup: GroupSchema = {
      ...group,
      metadata: {
        ...group.metadata,
        workspaceCount: Math.max(0, group.metadata.workspaceCount + increment),
        lastModified: new Date().toISOString()
      }
    };

    this.store.set('groups', {
      ...groups,
      [groupId]: updatedGroup
    });

    return true;
  }

  // Utility methods
  renameGroup(id: string, newName: string): boolean {
    return this.updateGroup(id, { name: newName });
  }

  setGroupExpanded(id: string, expanded: boolean): boolean {
    return this.updateGroup(id, { isExpanded: expanded });
  }

  changeGroupColor(id: string, color: GroupSchema['color']): boolean {
    return this.updateGroup(id, { color });
  }

  // Clean up orphaned groups (groups with no workspaces)
  cleanupEmptyGroups(): string[] {
    const groups = this.store.get('groups', {});
    const emptyGroupIds: string[] = [];

    Object.values(groups).forEach(group => {
      if (group.metadata.workspaceCount === 0) {
        emptyGroupIds.push(group.id);
        this.deleteGroup(group.id);
      }
    });

    return emptyGroupIds;
  }
}