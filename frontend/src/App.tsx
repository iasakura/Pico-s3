import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  gql,
  useLazyQuery,
  useQuery,
} from '@apollo/client';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import React, { useState } from 'react';

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

function b64toBlob(b64Data: string, contentType = '', sliceSize = 512) {
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

function downloadFiles(files: [string, string][]) {
  if (files.length === 0) {
    return;
  } else if (files.length === 1) {
    let [name, data] = files[0];
    let blob = b64toBlob(data, 'text/plain');
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

  if (listFilesError || getFileError) {
    return <p> Error occured: {listFilesError} </p>;
  } else if (listFilesLoading || getFileLoading) {
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

  let download = () => {
    Promise.all(
      Array.from(selected).map((id) => {
        let name = fileList.find((file: { id: string }) => id === file.id)
          ?.name as string;
        return getFile({ variables: { id: id } }).then(
          (result): [string, string] => [name, result.data.getFile],
        );
      }),
    ).then((files: [string, string][]) => downloadFiles(files));
  };

  let remove = () => {
    // TODO: implement
    alert('remove');
  };

  let refresh = () => {
    listFilesRefetch();
  };

  return (
    <div id="root">
      <button onClick={download}>download</button>
      <button onClick={remove}>remove</button>
      <button onClick={refresh}>reflesh</button>
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
