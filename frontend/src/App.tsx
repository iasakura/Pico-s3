import React, { useState } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";

import {
  useQuery,
  gql,
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client";

const client = new ApolloClient({
  uri: "http://localhost:5000/",
  cache: new InMemoryCache(),
});

function FileEntry(props: {
  fileName: string;
  fileSize: number;
  createDate: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <tr>
      <td>
        <input
          type="checkbox"
          onChange={props.onClick}
          checked={props.checked}
        />
      </td>
      <td>{props.fileName}</td>
      <td>{props.fileSize}</td>
      <td>{props.createDate}</td>
    </tr>
  );
}

function FileLists(props: {
  fileList: {
    id: string;
    name: string;
    fileSize: number;
    createDate: string;
    checked: boolean;
  }[];
  onClick: (id: string) => void;
}) {
  const files = props.fileList.map((file) => {
    return (
      <FileEntry
        fileName={file.name}
        key={file.id}
        fileSize={file.fileSize}
        createDate={file.createDate}
        checked={file.checked}
        onClick={() => props.onClick(file.id)}
      />
    );
  });

  return (
    <table>
      <thead>
        <tr>
          <th> Check </th>
          <th> File Name </th>
          <th> File Size </th>
          <th> Create Date </th>
        </tr>
      </thead>
      <tbody>{files}</tbody>
    </table>
  );
}

function b64toBlob(b64Data: string, contentType = "", sliceSize = 512) {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });
  return blob;
}

function downloadFiles(
  client: ApolloClient<NormalizedCacheObject>,
  selected: string[],
  files: {
    id: string;
    name: string;
    fileSize: number;
    createDate: string;
    checked: boolean;
  }[]
) {
  const query = gql`
    query Query($id: String) {
      getFile(id: $id)
    }
  `;

  if (selected.length === 0) {
    return;
  } else if (selected.length === 1) {
    let id = selected[0];

    let name = files.find((file) => id === file.id)?.name as string;
    client.query({ query: query, variables: { id: id } }).then((result) => {
      // TODO: Fix MIME type
      let blob = b64toBlob(result.data.getFile, "text/plain");
      saveAs(blob, name);
    });
  } else {
    let promises = selected.map((id): Promise<[Blob, string]> => {
      const name = files.find((file) => file.id === id)?.name as string;
      return client
        .query({ query: query, variables: { id: id } })
        .then((result) => {
          // base 64 encoded text and its file name
          return [result.data.getFile, name];
        });
    });
    Promise.all(promises).then((result) => {
      const zip = new JSZip();
      result.forEach(([text, name]) => {
        zip.file(name, text, { base64: true });
      });
      zip.generateAsync({ type: "blob" }).then((content) => {
        saveAs(content, "download.zip");
      });
    });
  }
}

function AppLocal() {
  let query = gql`
    query Query {
      listFiles {
        id
        name
        fileSize
        createDate
      }
    }
  `;

  let { loading, error, data, refetch } = useQuery(query);
  let [selected, setSelected] = useState<Set<string>>(new Set());

  if (error) {
    return <p> Error occured: {error} </p>;
  } else if (loading) {
    return <p> Now loading... </p>;
  }

  let handleClick = (id: string) => {
    if (selected.has(id)) {
      const new_selected = new Set(selected);
      new_selected.delete(id);
      setSelected(new_selected);
    } else {
      const new_selected = new Set(selected);
      new_selected.add(id);
      setSelected(new_selected);
    }
  };

  let fileList = data.listFiles.map(
    (file: {
      id: string;
      name: string;
      fileSize: number;
      createDate: string;
      checked: boolean;
    }) => {
      return { ...file, checked: selected.has(file.id) };
    }
  );

  let table = <FileLists fileList={fileList} onClick={handleClick} />;

  let download = () => {
    downloadFiles(client, Array.from(selected), fileList);
  };

  let remove = () => {
    alert("remove");
  };

  let refresh = () => {
    refetch();
  };

  return (
    <div id="root">
      <button onClick={download}>download</button>
      <button onClick={remove}>remove</button>
      <button onClick={refresh}>reflesh</button>
      {table}
    </div>
  );
}

function App() {
  return (
    <ApolloProvider client={client}>
      <AppLocal />
    </ApolloProvider>
  );
}

export default App;
