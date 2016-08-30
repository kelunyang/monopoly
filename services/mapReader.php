<?php
//param: GET mapindex
error_reporting(E_ALL);
$mapdata = ["upgrades","stages","questions","incidents","shortcuts","roads"];
$pointer = intval($_GET["mapindex"]);
header('Content-Type: application/json; charset=utf-8');
$xml = simplexml_load_file("../data/".$mapdata[$pointer].".xml");
$data = array();
switch($pointer) {
	case 0:
		for($i=0;$i<count($xml->Worksheet);$i++) {
			$sheet = $xml->Worksheet[$i];
			for($r=0;$r<count($sheet->Table->Row);$r++) {
				$row = $sheet->Table->Row[$r];
				$d = new upgrade();
				$d->name = (string)$row->Cell[0]->Data[0];
				$d->desc = (string)$row->Cell[4]->Data[0];
				$d->icon = (string)$row->Cell[3]->Data[0];
				$d->rent = (double)$row->Cell[1]->Data[0];
				$d->price = (int)$row->Cell[2]->Data[0];
				$d->stage = $i;
				$data[] = $d;
			}
		}
	break;
	case 1:
		$sheet = $xml->Worksheet[0];
		for($r=0;$r<count($sheet->Table->Row);$r++) {
			$row = $sheet->Table->Row[$r];
			$d = new stage();
			$d->name = (string)$row->Cell[0]->Data[0];
			$d->desc = (string)$row->Cell[1]->Data[0];
			$d->duration = (int)$row->Cell[2]->Data[0];
			$data[] = $d;
		}
	break;
	case 2:
		for($i=0;$i<count($xml->Worksheet);$i++) {
			$sheet = $xml->Worksheet[$i];
			for($r=0;$r<count($sheet->Table->Row);$r++) {
				$row = $sheet->Table->Row[$r];
				$d = new question();
				$d->question = (string)$row->Cell[0]->Data[0];
				$d->answer = (int)$row->Cell[2]->Data[0];
				$d->credit = (int)$row->Cell[1]->Data[0];
				$d->stage = $i;
				for($c=3;$c<count($row->Cell);$c++) {
					$d->answers[] = (string)$row->Cell[$c]->Data[0];
				}
				$data[] = $d;
			}
		}
	break;
	case 3:
		for($i=0;$i<count($xml->Worksheet);$i++) {
			$sheet = $xml->Worksheet[$i];
			for($r=0;$r<count($sheet->Table->Row);$r++) {
				$row = $sheet->Table->Row[$r];
				$d = new incident();
				$d->name = (string)$row->Cell[0]->Data[0];
				$d->desc = (string)$row->Cell[1]->Data[0];
				$d->effect = (double)$row->Cell[2]->Data[0];
				$d->stage = $i;
				$d->brick = (int)$row->Cell[3]->Data[0];
				$data[] = $d;
			}
		}
	break;
	case 4:
		$sheet = $xml->Worksheet[0];
		for($r=0;$r<count($sheet->Table->Row);$r++) {
			$row = $sheet->Table->Row[$r];
			$d = new shortcut();
			$d->name = (string)$row->Cell[0]->Data[0];
			$d->desc = (string)$row->Cell[1]->Data[0];
			$d->startturn = (int)$row->Cell[2]->Data[0];
			$d->endturn = (int)$row->Cell[3]->Data[0];
			for($c=4;$c<count($row->Cell);$c++) {
				$d->bricks[] = (int)$row->Cell[$c]->Data[0];
			}
			$data[] = $d;
		}
	break;
	case 5:
		for($i=0;$i<count($xml->Worksheet);$i++) {
			$sheet = $xml->Worksheet[$i];
			for($r=0;$r<count($sheet->Table->Row);$r++) {
				$row = $sheet->Table->Row[$r];
				$d = new road();
				$d->name = (string)$row->Cell[0]->Data[0];
				$d->desc = (string)$row->Cell[1]->Data[0];
				$d->brick = (int)$row->Cell[2]->Data[0];
				$d->next = (int)$row->Cell[3]->Data[0];
				$d->previous = (int)$row->Cell[4]->Data[0];
				$d->price = (int)$row->Cell[5]->Data[0];
				$data[] = $d;
			}
		}
	break;
}
echo(json_encode($data));
class upgrade {
	public $name,$desc,$icon,$rent,$price,$stage;
}
class stage {
	public $name,$desc,$duration;
}
class question {
	public $question,$answer,$credit,$stage;
	public $answers = array();
}
class shortcut {
	public $name,$desc,$startturn,$endturn;
	public $bricks = array();
}
class incident {
	public $name,$desc,$effect,$stage,$brick;
}
class road {
	public $name,$desc,$brick,$next,$price,$previous;
}
?>