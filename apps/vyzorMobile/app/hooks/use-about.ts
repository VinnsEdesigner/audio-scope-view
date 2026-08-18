import { useQuery } from "@apollo/client";
import {
  GET_ABOUT_INFO,
  GET_FEATURES,
  GET_CHANGELOG,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries";

export interface AboutInfo {
  aboutInfo: {
    description: string;
  } | null;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
}

export interface ChangelogChange {
  type: string;
  title: string;
  description: string;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  changes: ChangelogChange[];
}

export interface FeaturesData {
  features: Feature[];
}

export interface ChangelogData {
  changelog: ChangelogRelease[];
}

export function useAboutInfo() {
  return useQuery<AboutInfo>(GET_ABOUT_INFO, {
    fetchPolicy: "cache-and-network",
  });
}

export function useFeatures() {
  return useQuery<FeaturesData>(GET_FEATURES, {
    fetchPolicy: "cache-and-network",
  });
}

export function useChangelog() {
  return useQuery<ChangelogData>(GET_CHANGELOG, {
    fetchPolicy: "cache-and-network",
  });
}
