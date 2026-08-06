import { gql } from "@apollo/client";

export const CREATE_API_KEY = gql`
  mutation CreateApiKey($input: CreateApiKeyInput!) {
    createApiKey(input: $input) {
      id
      key
      name
    }
  }
`;

export const UPDATE_API_KEY = gql`
  mutation UpdateApiKey($id: String!, $input: UpdateApiKeyInput!) {
    updateApiKey(id: $id, input: $input)
  }
`;

export const DELETE_API_KEY = gql`
  mutation DeleteApiKey($id: String!) {
    deleteApiKey(id: $id)
  }
`;
