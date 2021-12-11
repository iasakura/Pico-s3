import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  gql,
  useLazyQuery,
  useMutation,
  useQuery,
} from '@apollo/client';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import React, { useState } from 'react';

import * as util from './util';

const LIST_FILES = gql`
  query Query {
    listFiles {
      id
      name
      fileSize
      createDate
    }
  }
`;

const GET_FILE = gql`
  query Query($id: String) {
    getFile(id: $id)
  }
`;

const PUT_FILE = gql`
  mutation Mutation($name: String, $contents: String) {
    putFile(name: $name, contents: $contents)
  }
`;

const REMOVE_FILE = gql`
  mutation Mutation($id: String) {
    removeFile(id: $id)
  }
`;

const client = new ApolloClient({
  uri: 'http://localhost:5000/',
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
  onCheckBoxChange: (id: string) => void;
}) {
  const files = props.fileList.map((file) => (
    <FileEntry
      fileName={file.name}
      key={file.id}
      fileSize={file.fileSize}
      createDate={file.createDate}
      checked={file.checked}
      onClick={() => props.onCheckBoxChange(file.id)}
    />
  ));

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

function downloadFiles(files: [string, string][]) {
  if (files.length === 0) {
    return;
  } else if (files.length === 1) {
    let [name, data] = files[0];
    let blob = util.b64toBlob(data, 'text/plain');
    saveAs(blob, name);
  } else {
    const zip = new JSZip();
    files.forEach(([name, data]) => {
      zip.file(name, data, { base64: true });
    });
    zip.generateAsync({ type: 'blob' }).then((content) => {
      saveAs(content, 'download.zip');
    });
  }
}

function AppLocal() {
  let {
    loading: listFilesLoading,
    error: listFilesError,
    data: filesData,
    refetch: listFilesRefetch,
  } = useQuery(LIST_FILES);
  let [getFile, { loading: getFileLoading, error: getFileError }] =
    useLazyQuery(GET_FILE);
  let [selected, setSelected] = useState(new Set<string>());
  let [putFile, { loading: putFileLoading, error: putFileError }] =
    useMutation(PUT_FILE);
  let [removeFile, { loading: removeFileLoading, error: removeFileError }] =
    useMutation(REMOVE_FILE);

  let any_error =
    listFilesError || getFileError || putFileError || removeFileError;
  let any_loading =
    listFilesLoading || getFileLoading || putFileLoading || removeFileLoading;
  if (any_error) {
    return (
      <p>
        Error occurred:
        {any_error?.message}
      </p>
    );
  } else if (any_loading) {
    return <p> Now loading... </p>;
  }

  // List of all files
  let fileList = filesData.listFiles.map(
    (file: {
      id: string;
      name: string;
      fileSize: number;
      createDate: string;
      checked: boolean;
    }) => {
      return { ...file, checked: selected.has(file.id) };
    },
  );

  // Toggle clicked checkbox
  let updateSelected = (id: string) => {
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

  const download = async () => {
    await Promise.all(
      Array.from(selected).map((id) => {
        let name = fileList.find((file: { id: string }) => id === file.id)
          ?.name as string;
        return getFile({ variables: { id: id } }).then(
          (result): [string, string] => {
            return [name, result.data.getFile];
          },
        );
      }),
    ).then((files: [string, string][]) => downloadFiles(files));
  };

  const remove = async () => {
    await Promise.all(
      Array.from(selected).map((id) => removeFile({ variables: { id: id } })),
    );
    setSelected(new Set());
    await listFilesRefetch();
  };

  const refresh = () => {
    listFilesRefetch();
  };

  const dropHandler = async (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();

    for (let i = 0; i < ev.dataTransfer.items.length; ++i) {
      const item = ev.dataTransfer.items[i];
      const file = item.getAsFile();
      if (file !== null) {
        let b64contents = await util.blobToB64(file);
        let name = file.name;

        await putFile({ variables: { name: name, contents: b64contents } });
      }
    }

    await listFilesRefetch();
  };

  const dragHandler = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
  };

  return (
    <div id="app" onDrop={dropHandler} onDragOver={dragHandler}>
      <button onClick={download}>download</button>
      <button onClick={remove}>remove</button>
      <button onClick={refresh}>refresh</button>
      <FileLists fileList={fileList} onCheckBoxChange={updateSelected} />
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
