import { gql } from "@apollo/client";

export const GET_ABOUT_INFO = gql`
  query GetAboutInfo {
    aboutInfo {
      description
    }
  }
`;

export const GET_FEATURES = gql`
  query GetFeatures {
    features {
      id
      title
      description
    }
  }
`;

export const GET_CHANGELOG = gql`
  query GetChangelog {
    changelog {
      version
      date
      changes {
        type
        title
        description
      }
    }
  }
`;
