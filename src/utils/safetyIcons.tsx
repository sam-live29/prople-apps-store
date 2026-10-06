import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  HardDrive, 
  EyeOff, 
  FileCode, 
  CheckCircle2, 
  Zap, 
  Trash2, 
  Share2, 
  Database, 
  KeyRound, 
  BadgeCheck, 
  Fingerprint, 
  Globe, 
  Server, 
  Ban
} from 'lucide-react';

/**
 * Resolves a production-grade monochrome application marketplace SVG icon
 * for any security or data safety highlight.
 *
 * Supports explicit icon keys AND semantic keyword detection for multiple dynamic highlights.
 */
export function getSafetyHighlightIcon(icon?: string, title: string = '', description: string = ''): React.ReactNode {
  const normalizedIcon = icon?.toLowerCase().trim() || '';
  const text = `${title} ${description}`.toLowerCase();

  const iconClass = "w-5 h-5 text-theme-text-muted shrink-0 mt-0.5 stroke-[1.75]";

  // 1. Explicit icon key matching
  if (normalizedIcon === 'lock' || normalizedIcon === 'encryption' || normalizedIcon === 'encrypted') {
    return <Lock className={iconClass} />;
  }
  if (normalizedIcon === 'hard-drive' || normalizedIcon === 'offline' || normalizedIcon === 'local' || normalizedIcon === 'storage') {
    return <HardDrive className={iconClass} />;
  }
  if (normalizedIcon === 'eye-off' || normalizedIcon === 'no-tracking' || normalizedIcon === 'privacy' || normalizedIcon === 'anonymous') {
    return <EyeOff className={iconClass} />;
  }
  if (normalizedIcon === 'trash' || normalizedIcon === 'delete' || normalizedIcon === 'deletion') {
    return <Trash2 className={iconClass} />;
  }
  if (normalizedIcon === 'share' || normalizedIcon === 'sharing' || normalizedIcon === 'transfer') {
    return <Share2 className={iconClass} />;
  }
  if (normalizedIcon === 'database' || normalizedIcon === 'data' || normalizedIcon === 'collected') {
    return <Database className={iconClass} />;
  }
  if (normalizedIcon === 'badge-check' || normalizedIcon === 'verified' || normalizedIcon === 'audit' || normalizedIcon === 'certified') {
    return <BadgeCheck className={iconClass} />;
  }
  if (normalizedIcon === 'code' || normalizedIcon === 'open-source' || normalizedIcon === 'github') {
    return <FileCode className={iconClass} />;
  }
  if (normalizedIcon === 'key' || normalizedIcon === 'permission' || normalizedIcon === 'permissions') {
    return <KeyRound className={iconClass} />;
  }
  if (normalizedIcon === 'fingerprint' || normalizedIcon === 'auth') {
    return <Fingerprint className={iconClass} />;
  }
  if (normalizedIcon === 'ban' || normalizedIcon === 'ad-free' || normalizedIcon === 'no-ads') {
    return <Ban className={iconClass} />;
  }
  if (normalizedIcon === 'globe' || normalizedIcon === 'network' || normalizedIcon === 'web') {
    return <Globe className={iconClass} />;
  }
  if (normalizedIcon === 'server') {
    return <Server className={iconClass} />;
  }
  if (normalizedIcon === 'zap' || normalizedIcon === 'fast') {
    return <Zap className={iconClass} />;
  }
  if (normalizedIcon === 'check' || normalizedIcon === 'passed') {
    return <CheckCircle2 className={iconClass} />;
  }
  if (normalizedIcon === 'shield' || normalizedIcon === 'safety' || normalizedIcon === 'protect') {
    return <ShieldCheck className={iconClass} />;
  }

  // 2. Intelligent semantic keyword detection for multiple dynamic highlights
  if (text.includes('encrypt') || text.includes('transit') || text.includes('ssl') || text.includes('tls') || text.includes('crypt')) {
    return <Lock className={iconClass} />;
  }
  if (text.includes('delete') || text.includes('erasure') || text.includes('retention') || text.includes('purge') || text.includes('remove data')) {
    return <Trash2 className={iconClass} />;
  }
  if (text.includes('no data shared') || text.includes('not shared') || text.includes('share') || text.includes('third party') || text.includes('third-party')) {
    return <Share2 className={iconClass} />;
  }
  if (text.includes('track') || text.includes('telemetry') || text.includes('anonym') || text.includes('ad identifier') || text.includes('privacy') || text.includes('spyware')) {
    return <EyeOff className={iconClass} />;
  }
  if (text.includes('ad free') || text.includes('no ads') || text.includes('no ad') || text.includes('ad-free')) {
    return <Ban className={iconClass} />;
  }
  if (text.includes('offline') || text.includes('local') || text.includes('on-device') || text.includes('device only') || text.includes('standalone')) {
    return <HardDrive className={iconClass} />;
  }
  if (text.includes('open source') || text.includes('source code') || text.includes('repository') || text.includes('commit') || text.includes('transparent')) {
    return <FileCode className={iconClass} />;
  }
  if (text.includes('collect') || text.includes('storage') || text.includes('database') || text.includes('user data') || text.includes('analytics')) {
    return <Database className={iconClass} />;
  }
  if (text.includes('verified') || text.includes('audit') || text.includes('review') || text.includes('certified') || text.includes('passed') || text.includes('signed')) {
    return <BadgeCheck className={iconClass} />;
  }
  if (text.includes('permission') || text.includes('sandbox') || text.includes('access control')) {
    return <KeyRound className={iconClass} />;
  }

  // Default app store security icon
  return <ShieldCheck className={iconClass} />;
}
