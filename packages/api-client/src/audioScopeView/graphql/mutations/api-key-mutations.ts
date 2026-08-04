import { gql } from "@apollo/client";

export const CREATE_API_KEY = gql`
  mutation CreateApiKey($input: CreateApiKeyInput!) {
    create_api_key(input: $input) {
      id
      key
      name
    }
  }
`;

export const UPDATE_API_KEY = gql`
  mutation UpdateApiKey($id: String!, $input: UpdateApiKeyInput!) {
    update_api_key(id: $id, input: $input)
  }
`;

export const DELETE_API_KEY = gql`
  mutation DeleteApiKey($id: String!) {
    delete_api_key(id: $id)
  }
`;
