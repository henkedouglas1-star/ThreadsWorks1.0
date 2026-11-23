import React from "react";
import { UserProfile } from "../types";
import CalendarView from "./CalendarView";

interface ContentLibraryViewProps {
  profile: UserProfile | null;
  subscriptionStatus?: string;
  onNavigateToTab?: (tab: string) => void;
}

/**
 * Unified Content Library entry point.
 * Delegates to CalendarView's canonical Smart Content Library workspace
 * to keep planning, organization, scheduling, and publishing in one synchronized surface.
 */
export default function ContentLibraryView({
  profile,
  subscriptionStatus,
  onNavigateToTab,
}: ContentLibraryViewProps) {
  return (
    <CalendarView
      profile={profile}
      subscriptionStatus={subscriptionStatus}
      onNavigateToTab={onNavigateToTab}
      initialSubView="library"
    />
  );
}
