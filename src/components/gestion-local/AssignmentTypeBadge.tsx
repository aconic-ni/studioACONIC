"use client";
import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { Timestamp } from 'firebase/firestore';

interface AssignmentTypeBadgeProps {
  assignmentDate?: Timestamp | null;
  digitadorAssignedAt?: Timestamp | null;
}

export function AssignmentTypeBadge({ assignmentDate, digitadorAssignedAt }: AssignmentTypeBadgeProps) {
  let type: 'aforador' | 'digitador' | null = null;
  let latestTime = 0;

  if (assignmentDate) {
    const aforoTime = assignmentDate.toMillis();
    if (aforoTime > latestTime) {
      latestTime = aforoTime;
      type = 'aforador';
    }
  }

  if (digitadorAssignedAt) {
    const digitadorTime = digitadorAssignedAt.toMillis();
    if (digitadorTime > latestTime) {
      type = 'digitador';
    }
  }

  if (type === 'aforador') {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 w-6 h-6 flex items-center justify-center p-0">
        <span className="font-bold text-xs">A</span>
      </Badge>
    );
  }

  if (type === 'digitador') {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200 w-6 h-6 flex items-center justify-center p-0">
        <span className="font-bold text-xs">D</span>
      </Badge>
    );
  }

  return null; // Return null if no assignment date is found
}
