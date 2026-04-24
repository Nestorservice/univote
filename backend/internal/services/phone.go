package services

import "strings"

// DetectOperator détecte l'opérateur mobile camerounais à partir du numéro de téléphone.
// Orange Cameroun: 655, 656, 657, 658, 659, 690, 691, 692, 693, 694, 695, 696, 697, 698, 699
// MTN Cameroun: 650, 651, 652, 653, 654, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688, 689
func DetectOperator(phone string) string {
	// Nettoyer le numéro
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.ReplaceAll(phone, "+", "")

	// Supprimer le préfixe international 237
	if strings.HasPrefix(phone, "237") && len(phone) > 9 {
		phone = phone[3:]
	}

	// Vérifier la longueur (9 chiffres pour le Cameroun)
	if len(phone) < 9 {
		return "unknown"
	}

	// Prendre les 3 premiers chiffres
	prefix := phone[:3]

	// Préfixes Orange Cameroun
	orangePrefixes := map[string]bool{
		"655": true, "656": true, "657": true, "658": true, "659": true,
		"690": true, "691": true, "692": true, "693": true, "694": true,
		"695": true, "696": true, "697": true, "698": true, "699": true,
	}

	// Préfixes MTN Cameroun
	mtnPrefixes := map[string]bool{
		"650": true, "651": true, "652": true, "653": true, "654": true,
		"670": true, "671": true, "672": true, "673": true, "674": true,
		"675": true, "676": true, "677": true, "678": true, "679": true,
		"680": true, "681": true, "682": true, "683": true, "684": true,
		"685": true, "686": true, "687": true, "688": true, "689": true,
	}

	if orangePrefixes[prefix] {
		return "orange"
	}
	if mtnPrefixes[prefix] {
		return "mtn"
	}

	return "unknown"
}
