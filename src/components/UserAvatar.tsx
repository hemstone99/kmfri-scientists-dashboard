import React from 'react';
import { UserProfile } from '../types/kmfri.ts';

interface UserAvatarProps {
  user?: Pick<UserProfile, 'full_name' | 'title' | 'avatar_url'> | null;
  name?: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showOnline?: boolean;
  isOnline?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

const DOT_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-2 h-2 -bottom-0.5 -right-0.5',
  sm: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5',
  md: 'w-3 h-3 bottom-0 right-0',
  lg: 'w-3.5 h-3.5 bottom-0.5 right-0.5',
  xl: 'w-4 h-4 bottom-1 right-1',
};

export function getInitials(fullName?: string): string {
  if (!fullName) return 'KM';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function UserAvatar({
  user,
  name,
  avatarUrl,
  size = 'md',
  isOnline,
  className = '',
}: UserAvatarProps) {
  const resolvedName = user?.full_name || name || 'KMFRI Researcher';
  const resolvedAvatar = user?.avatar_url || avatarUrl;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {resolvedAvatar ? (
        <img
          src={resolvedAvatar}
          alt={resolvedName}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover border border-sky-500/40 bg-slate-800`}
        />
      ) : (
        <div
          className={`${SIZE_CLASSES[size]} rounded-full bg-gradient-to-br from-[#0A2540] via-sky-700 to-teal-600 text-white font-bold font-mono flex items-center justify-center border border-sky-400/30 select-none`}
          title={resolvedName}
        >
          {getInitials(resolvedName)}
        </div>
      )}
      {isOnline !== undefined && (
        <span
          title={isOnline ? 'Online Now' : 'Offline'}
          className={`absolute rounded-full border-2 border-white dark:border-slate-900 ${
            DOT_CLASSES[size]
          } ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
        />
      )}
    </div>
  );
}
